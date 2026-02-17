import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance } from "../api/axios-instance";
import type { PolicyResponse } from "../api/model/policyResponse";
import type { PaginatedResponsePolicyResponse } from "../api/model/paginatedResponsePolicyResponse";
import axios from "axios";

interface ApprovalResponse {
  id: string;
  policy_id: string;
  approver_id: string;
  approved_at: string;
  comment: string | null;
}

interface PaginatedApprovals {
  items: ApprovalResponse[];
  total: number;
  limit: number;
  offset: number;
}

export default function Policies() {
  const { logout } = useAuth();
  const { getName } = useMembers();
  const [policies, setPolicies] = useState<PolicyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailPolicy, setDetailPolicy] = useState<PolicyResponse | null>(null);
  const [approvals, setApprovals] = useState<ApprovalResponse[]>([]);
  const [approvalComment, setApprovalComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const familyId = localStorage.getItem("nagz_family_id");

  const loadPolicies = async () => {
    if (!familyId) return;
    setLoading(true);
    try {
      const data = await customInstance<PaginatedResponsePolicyResponse>({
        url: "/api/v1/policies",
        method: "GET",
        params: { family_id: familyId },
      });
      setPolicies(data.items);
    } catch {
      setError("Failed to load policies");
    }
    setLoading(false);
  };

  const loadApprovals = async (policyId: string) => {
    try {
      const data = await customInstance<PaginatedApprovals>({
        url: `/api/v1/policies/${policyId}/approvals`,
        method: "GET",
      });
      setApprovals(data.items);
    } catch {
      setApprovals([]);
    }
  };

  const submitApproval = async () => {
    if (!detailPolicy) return;
    setSubmitting(true);
    try {
      await customInstance<ApprovalResponse>({
        url: `/api/v1/policies/${detailPolicy.id}/approvals`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { comment: approvalComment || null },
      });
      setApprovalComment("");
      await loadApprovals(detailPolicy.id);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error?.message ?? "Failed to approve");
      }
    }
    setSubmitting(false);
  };

  useEffect(() => {
    loadPolicies();
  }, [familyId]);

  useEffect(() => {
    if (detailPolicy) {
      loadApprovals(detailPolicy.id);
    } else {
      setApprovals([]);
    }
  }, [detailPolicy?.id]);

  if (!familyId) {
    return (
      <div>
        <p>No family selected. <Link to="/">Go to dashboard</Link></p>
      </div>
    );
  }

  if (loading) return <p>Loading policies...</p>;
  if (error && !detailPolicy) return <p className="error">{error}</p>;

  const formatStrategy = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div>
      <div className="header">
        <h2>Family Policies</h2>
        <div className="header-actions">
          <Link to="/">Family</Link>
          <button onClick={logout} className="link-button">Logout</button>
        </div>
      </div>

      <p className="page-hint">
        View and manage family nagging policies. Tap a policy to see details and co-owner approvals.
      </p>

      {policies.length === 0 ? (
        <p>No policies found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Status</th>
              <th>Owners</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id}>
                <td>
                  <button className="link-button" onClick={() => setDetailPolicy(p)}>
                    {formatStrategy(p.strategy_template)}
                  </button>
                </td>
                <td>
                  <span
                    className="badge"
                    style={{ backgroundColor: p.status === "active" ? "#22c55e" : "#6b7280" }}
                  >
                    {p.status}
                  </span>
                </td>
                <td>
                  {(p.owners as string[]).map((o) => getName(o)).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {detailPolicy && (
        <div className="modal-overlay" onClick={() => setDetailPolicy(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Policy Details</h3>
            <dl className="detail-list">
              <dt>Strategy</dt>
              <dd>{formatStrategy(detailPolicy.strategy_template)}</dd>
              <dt>Status</dt>
              <dd>
                <span
                  className="badge"
                  style={{ backgroundColor: detailPolicy.status === "active" ? "#22c55e" : "#6b7280" }}
                >
                  {detailPolicy.status}
                </span>
              </dd>
              <dt>Owners</dt>
              <dd>{(detailPolicy.owners as string[]).map((o) => getName(o)).join(", ")}</dd>
            </dl>

            <h4 style={{ marginTop: "1rem" }}>Approvals ({approvals.length})</h4>
            {approvals.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>No approvals yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Approver</th>
                    <th>Date</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((a) => (
                    <tr key={a.id}>
                      <td>{getName(a.approver_id)}</td>
                      <td>{new Date(a.approved_at).toLocaleDateString()}</td>
                      <td>{a.comment ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {detailPolicy.status === "active" && (
              <div className="form" style={{ marginTop: "1rem" }}>
                <label>
                  Approval Comment
                  <input
                    type="text"
                    placeholder="Optional comment"
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                  />
                </label>
                {error && <p className="error">{error}</p>}
                <button onClick={submitApproval} disabled={submitting}>
                  {submitting ? "Approving..." : "Approve Policy"}
                </button>
              </div>
            )}

            <div className="card-actions" style={{ marginTop: "1rem" }}>
              <button className="btn-secondary" onClick={() => setDetailPolicy(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

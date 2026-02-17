import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { customInstance } from "../api/axios-instance";
import { useMembers } from "../members";
import type { NagResponse } from "../api/model";
import axios from "axios";
import { CreateNagModal } from "./CreateNag";

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  completed: "#22c55e",
  missed: "#ef4444",
  cancelled_relationship_change: "#6b7280",
};

const CATEGORIES = ["chores", "meds", "homework", "appointments", "other"];
const DONE_DEFS = [
  { value: "ack_only", label: "Acknowledge" },
  { value: "binary_check", label: "Check Off" },
  { value: "binary_with_note", label: "Check Off + Note" },
];

export default function NagList() {
  const { userId, logout } = useAuth();
  const [nags, setNags] = useState<NagResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [detailNag, setDetailNag] = useState<NagResponse | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { getName, loading: membersLoading } = useMembers();

  // Escalation state
  const [detailEscalation, setDetailEscalation] = useState<{ current_phase: string } | null>(null);
  const [recomputing, setRecomputing] = useState(false);

  // Edit nag state
  const [editing, setEditing] = useState(false);
  const [editDueAt, setEditDueAt] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDoneDef, setEditDoneDef] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const familyId = localStorage.getItem("nagz_family_id");

  const loadNags = async () => {
    if (!familyId) return;
    try {
      const params: Record<string, string> = { family_id: familyId };
      if (filter) params.state = filter;
      const data = await customInstance<NagResponse[]>({
        url: "/api/v1/nags",
        method: "GET",
        params,
      });
      setNags(data);
    } catch {
      setError("Failed to load nagz");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadNags();
  }, [familyId, filter]);

  useEffect(() => {
    if (!detailNag || detailNag.status !== "open") {
      setDetailEscalation(null);
      return;
    }
    (async () => {
      try {
        const esc = await customInstance<{ current_phase: string }>({
          url: `/api/v1/nags/${detailNag.id}/escalation`,
          method: "GET",
        });
        setDetailEscalation(esc);
      } catch {
        setDetailEscalation(null);
      }
    })();
  }, [detailNag?.id]);

  const recomputeEscalation = async () => {
    if (!detailNag) return;
    setRecomputing(true);
    try {
      const esc = await customInstance<{ current_phase: string }>({
        url: `/api/v1/nags/${detailNag.id}/escalation/recompute`,
        method: "POST",
      });
      setDetailEscalation(esc);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setEditError(err.response?.data?.error?.message ?? "Failed to recompute");
      }
    }
    setRecomputing(false);
  };

  const formatPhase = (p: string) => {
    const map: Record<string, string> = {
      phase_0_initial: "Created",
      phase_1_due_soon: "Due Soon",
      phase_2_overdue_soft: "Overdue",
      phase_3_overdue_bounded_pushback: "Escalated",
      phase_4_guardian_review: "Guardian Review",
    };
    return map[p] ?? p;
  };

  const startEditing = (nag: NagResponse) => {
    setEditing(true);
    setEditDueAt(nag.due_at.slice(0, 16)); // datetime-local format
    setEditCategory(nag.category);
    setEditDoneDef(nag.done_definition);
    setEditError("");
  };

  const saveEdit = async () => {
    if (!detailNag) return;
    setSaving(true);
    setEditError("");
    const updates: Record<string, unknown> = {};
    if (editDueAt !== detailNag.due_at.slice(0, 16)) {
      updates.due_at = new Date(editDueAt).toISOString();
    }
    if (editCategory !== detailNag.category) updates.category = editCategory;
    if (editDoneDef !== detailNag.done_definition) updates.done_definition = editDoneDef;

    if (Object.keys(updates).length === 0) {
      setEditing(false);
      setSaving(false);
      return;
    }

    try {
      await customInstance<NagResponse>({
        url: `/api/v1/nags/${detailNag.id}`,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: updates,
      });
      setEditing(false);
      setDetailNag(null);
      await loadNags();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setEditError(err.response?.data?.error?.message ?? "Failed to update nag");
      } else {
        setEditError("Failed to update nag");
      }
    }
    setSaving(false);
  };

  if (!familyId) {
    return (
      <div>
        <p>
          No family selected. <Link to="/">Go to dashboard</Link>
        </p>
      </div>
    );
  }

  if (loading || membersLoading) return <p>Loading nagz...</p>;
  if (error) return <p className="error">{error}</p>;

  const statusLabel = (s: string) =>
    s.startsWith("cancelled") ? "cancelled" : s;

  return (
    <div>
      <div className="header">
        <h2>All Nagz</h2>
        <div className="header-actions">
          <Link to="/">Family</Link>
          <Link to="/leaderboard">Leaderboard</Link>
          <span className="logged-in-as">{getName(userId!)}</span>
          <button onClick={logout} className="link-button">Logout</button>
        </div>
      </div>

      <p className="page-hint">
        All nagz across the family. Use the filters to show only open, completed, or missed nagz.
      </p>

      <div className="filters">
        <button
          className={!filter ? "active" : ""}
          onClick={() => setFilter("")}
        >
          All
        </button>
        <button
          className={filter === "open" ? "active" : ""}
          onClick={() => setFilter("open")}
        >
          Open
        </button>
        <button
          className={filter === "completed" ? "active" : ""}
          onClick={() => setFilter("completed")}
        >
          Completed
        </button>
        <button
          className={filter === "missed" ? "active" : ""}
          onClick={() => setFilter("missed")}
        >
          Missed
        </button>
      </div>

      {nags.length === 0 ? (
        <p>No nagz found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Status</th>
              <th>Recipient</th>
              <th>From</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {nags.map((nag) => (
              <tr key={nag.id}>
                <td>
                  <button
                    className="link-button"
                    onClick={() => setDetailNag(nag)}
                  >
                    {nag.category}
                  </button>
                  {nag.description && (
                    <div className="nag-description">{nag.description}</div>
                  )}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: STATUS_COLORS[nag.status] ?? "#6b7280",
                    }}
                  >
                    {statusLabel(nag.status)}
                  </span>
                </td>
                <td>{getName(nag.recipient_id)}</td>
                <td>{getName(nag.creator_id)}</td>
                <td>{new Date(nag.due_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {detailNag && (
        <div className="modal-overlay" onClick={() => setDetailNag(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nag Details</h3>
            <dl className="detail-list">
              <dt>Category</dt>
              <dd>
                <span className="badge badge-category">{detailNag.category}</span>
              </dd>
              <dt>Status</dt>
              <dd>
                <span
                  className={`badge badge-${statusLabel(detailNag.status)}`}
                >
                  {statusLabel(detailNag.status)}
                </span>
              </dd>
              <dt>Recipient</dt>
              <dd>{getName(detailNag.recipient_id)}</dd>
              <dt>From</dt>
              <dd>{getName(detailNag.creator_id)}</dd>
              <dt>Due</dt>
              <dd>{new Date(detailNag.due_at).toLocaleString()}</dd>
              <dt>Created</dt>
              <dd>{new Date(detailNag.created_at).toLocaleString()}</dd>
              {detailNag.description && (
                <>
                  <dt>Description</dt>
                  <dd>{detailNag.description}</dd>
                </>
              )}
              <dt>Done Definition</dt>
              <dd>{detailNag.done_definition}</dd>
              <dt>Strategy</dt>
              <dd>{detailNag.strategy_template}</dd>
              {detailEscalation && (
                <>
                  <dt>Escalation</dt>
                  <dd>
                    <span className="badge" style={{ marginRight: "0.5rem" }}>
                      {formatPhase(detailEscalation.current_phase)}
                    </span>
                    <button
                      className="link-button"
                      style={{ fontSize: "0.8rem" }}
                      onClick={recomputeEscalation}
                      disabled={recomputing}
                    >
                      {recomputing ? "..." : "Recompute"}
                    </button>
                  </dd>
                </>
              )}
            </dl>
            {editing ? (
              <div className="form" style={{ marginTop: "1rem" }}>
                <label>
                  Due Date
                  <input
                    type="datetime-local"
                    value={editDueAt}
                    onChange={(e) => setEditDueAt(e.target.value)}
                  />
                </label>
                <label>
                  Category
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Completion Type
                  <select value={editDoneDef} onChange={(e) => setEditDoneDef(e.target.value)}>
                    {DONE_DEFS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </label>
                {editError && <p className="error">{editError}</p>}
                <div className="card-actions">
                  <button onClick={saveEdit} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button className="btn-secondary" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="card-actions">
                {detailNag.status === "open" && (
                  <button onClick={() => startEditing(detailNag)}>
                    Edit Nag
                  </button>
                )}
                <button
                  onClick={() => {
                    setDetailNag(null);
                    setShowCreate(true);
                  }}
                >
                  Create Nagz
                </button>
                <button className="btn-secondary" onClick={() => { setDetailNag(null); setEditing(false); }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && familyId && (
        <CreateNagModal
          familyId={familyId}
          recipientId={detailNag?.recipient_id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadNags();
          }}
        />
      )}
    </div>
  );
}

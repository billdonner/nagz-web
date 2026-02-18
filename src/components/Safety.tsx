import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance, extractErrorMessage } from "../api/axios-instance";
import { UUID_DISPLAY_LENGTH } from "../nag-utils";

export default function Safety() {
  const { userId, logout } = useAuth();
  const { members, getName } = useMembers();
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const otherMembers = members.filter((m) => m.user_id !== userId);

  const handleReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!reportTarget || !reportReason.trim()) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await customInstance<unknown>({
        url: "/api/v1/abuse-reports",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { target_id: reportTarget, reason: reportReason.trim() },
      });
      setSuccess("Report submitted successfully.");
      setReportTarget(null);
      setReportReason("");
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to submit report."));
    }
    setSubmitting(false);
  };

  const handleBlock = async (targetId: string) => {
    if (!confirm(`Block ${getName(targetId)}? They won't be able to interact with you.`)) return;
    setError("");
    setSuccess("");
    try {
      await customInstance<unknown>({
        url: "/api/v1/blocks",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { target_id: targetId },
      });
      setSuccess(`${getName(targetId)} has been blocked.`);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to block member."));
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    setDeleting(true);
    setError("");
    try {
      await customInstance<unknown>({
        url: `/api/v1/accounts/${userId}`,
        method: "DELETE",
      });
      logout();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to delete account."));
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  return (
    <div>
      <div className="header">
        <h2>Safety & Account</h2>
        <div className="header-actions">
          <Link to="/">Family</Link>
          <span className="logged-in-as">{getName(userId ?? "")}</span>
          <button onClick={logout} className="link-button">Logout</button>
        </div>
      </div>

      <p className="page-hint">
        Use these tools if you feel unsafe or need to report inappropriate behavior.
      </p>

      {error && <p className="error">{error}</p>}
      {success && <p style={{ color: "#22c55e", fontWeight: 600 }}>{success}</p>}

      <h3>Report a Member</h3>
      {reportTarget ? (
        <form onSubmit={handleReport} className="form">
          <p>Reporting: <strong>{getName(reportTarget)}</strong></p>
          <label>
            Reason
            <textarea
              placeholder="Describe the issue..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={4}
              required
            />
          </label>
          <div className="card-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setReportTarget(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="card-list">
          {otherMembers.map((m) => (
            <button
              key={m.user_id}
              className="link-button"
              onClick={() => setReportTarget(m.user_id)}
              style={{ display: "block", marginBottom: "0.5rem" }}
            >
              Report {m.display_name ?? m.user_id.slice(0, UUID_DISPLAY_LENGTH)}
            </button>
          ))}
        </div>
      )}

      <h3 style={{ marginTop: "2rem" }}>Block a Member</h3>
      <div className="card-list">
        {otherMembers.map((m) => (
          <button
            key={m.user_id}
            className="link-button"
            style={{ display: "block", marginBottom: "0.5rem", color: "#ef4444" }}
            onClick={() => handleBlock(m.user_id)}
          >
            Block {m.display_name ?? m.user_id.slice(0, UUID_DISPLAY_LENGTH)}
          </button>
        ))}
      </div>

      <h3 style={{ marginTop: "2rem" }}>Delete Account</h3>
      <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
        Permanently delete your account, remove you from all families, and cancel your open nags.
      </p>
      {showDeleteConfirm ? (
        <div className="card-actions">
          <button
            style={{ background: "#ef4444", color: "white", border: "none" }}
            onClick={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Confirm Delete"}
          </button>
          <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="link-button"
          style={{ color: "#ef4444" }}
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete My Account
        </button>
      )}
    </div>
  );
}

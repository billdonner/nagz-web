import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { customInstance } from "../api/axios-instance";
import type { NagResponse } from "../api/model";

export default function KidView() {
  const { userId } = useAuth();
  const familyId = localStorage.getItem("nagz_family_id");
  const [nags, setNags] = useState<NagResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Excuse modal state
  const [excuseNagId, setExcuseNagId] = useState<string | null>(null);
  const [excuseText, setExcuseText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadNags = async () => {
    if (!familyId) return;
    try {
      const data = await customInstance<NagResponse[]>({
        url: "/api/v1/nags",
        method: "GET",
        params: { family_id: familyId },
      });
      // Filter to only this user's nags
      setNags(data.filter((n) => n.recipient_id === userId));
    } catch {
      setError("Failed to load nags");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadNags();
  }, [familyId, userId]);

  const markComplete = async (nagId: string) => {
    try {
      await customInstance<NagResponse>({
        url: `/api/v1/nags/${nagId}/status`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { status: "completed" },
      });
      await loadNags();
    } catch {
      setError("Failed to mark nag as complete");
    }
  };

  const submitExcuse = async (e: FormEvent) => {
    e.preventDefault();
    if (!excuseNagId || !excuseText.trim()) return;
    setSubmitting(true);
    try {
      await customInstance<unknown>({
        url: `/api/v1/nags/${excuseNagId}/excuses`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { text: excuseText.trim() },
      });
      setExcuseNagId(null);
      setExcuseText("");
    } catch {
      setError("Failed to submit excuse");
    }
    setSubmitting(false);
  };

  if (!familyId) {
    return (
      <p>
        No family selected. <Link to="/">Go to dashboard</Link>
      </p>
    );
  }

  if (loading) return <p>Loading your nags...</p>;

  const openNags = nags.filter((n) => n.status === "open");
  const doneNags = nags.filter((n) => n.status !== "open");

  return (
    <div>
      <div className="header">
        <h2>My Nags</h2>
        <Link to="/" className="btn-secondary">
          Back
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      <h3>Open ({openNags.length})</h3>
      {openNags.length === 0 ? (
        <p>No open nags. You're all caught up!</p>
      ) : (
        <div className="card-list">
          {openNags.map((nag) => (
            <div key={nag.id} className="card">
              <div className="card-header">
                <span className="badge badge-category">{nag.category}</span>
                <span className="due-date">
                  Due: {new Date(nag.due_at).toLocaleString()}
                </span>
              </div>
              <div className="card-actions">
                <button onClick={() => markComplete(nag.id)}>
                  Mark Complete
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setExcuseNagId(nag.id)}
                >
                  Submit Excuse
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {doneNags.length > 0 && (
        <>
          <h3>History ({doneNags.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Status</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {doneNags.map((nag) => (
                <tr key={nag.id}>
                  <td>{nag.category}</td>
                  <td>
                    <span className={`badge badge-${nag.status}`}>
                      {nag.status}
                    </span>
                  </td>
                  <td>{new Date(nag.due_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {excuseNagId && (
        <div className="modal-overlay" onClick={() => setExcuseNagId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Submit Excuse</h3>
            <form onSubmit={submitExcuse}>
              <textarea
                placeholder="Why can't you complete this nag?"
                value={excuseText}
                onChange={(e) => setExcuseText(e.target.value)}
                rows={4}
                autoFocus
              />
              <div className="card-actions">
                <button type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setExcuseNagId(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

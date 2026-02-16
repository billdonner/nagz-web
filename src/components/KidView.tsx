import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance } from "../api/axios-instance";
import type { NagResponse } from "../api/model";
import axios from "axios";

export default function KidView() {
  const { userId, logout } = useAuth();
  const { getName, members } = useMembers();
  const [searchParams] = useSearchParams();
  const viewUserId = searchParams.get("user") ?? userId;
  const isOwnView = viewUserId === userId;
  const familyId = localStorage.getItem("nagz_family_id");
  const myRole = members.find((m) => m.user_id === userId)?.role;
  const [nags, setNags] = useState<NagResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("open");

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
      setNags(data.filter((n) => n.recipient_id === viewUserId));
    } catch {
      setError("Failed to load nags");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadNags();
  }, [familyId, viewUserId]);

  const markComplete = async (nagId: string) => {
    setError("");
    try {
      await customInstance<NagResponse>({
        url: `/api/v1/nags/${nagId}/status`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { status: "completed" },
      });
      await loadNags();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError("Failed to mark nag as complete");
      }
    }
  };

  const submitExcuse = async (e: FormEvent) => {
    e.preventDefault();
    if (!excuseNagId || !excuseText.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await customInstance<unknown>({
        url: `/api/v1/nags/${excuseNagId}/excuses`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { text: excuseText.trim() },
      });
      setExcuseNagId(null);
      setExcuseText("");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError("Failed to submit excuse");
      }
    }
    setSubmitting(false);
  };

  if (!familyId) {
    return (
      <p>
        No family selected. <Link to="/family">Go to dashboard</Link>
      </p>
    );
  }

  if (loading) return <p>Loading nags...</p>;

  const filtered = filter
    ? nags.filter((n) => n.status === filter)
    : nags;

  const statusLabel = (s: string) =>
    s.startsWith("cancelled") ? "cancelled" : s;

  return (
    <div>
      <div className="header">
        <h2>{getName(viewUserId!)}'s Nags</h2>
        <div className="header-actions">
          <span className="logged-in-as">{getName(userId!)}</span>
          {myRole === "guardian" && <Link to="/family">Family</Link>}
          <button onClick={logout} className="link-button">Logout</button>
        </div>
      </div>

      <p className="page-hint">
        {isOwnView
          ? myRole === "guardian"
            ? "Your nags. Use the Family page to see all members and create nags."
            : "These are your nags. Mark them complete when done, or submit an excuse if you can't finish."
          : `Viewing ${getName(viewUserId!)}'s nags. Only they can mark nags complete or submit excuses.`}
      </p>

      <div className="filters">
        {["", "open", "completed", "missed"].map((f) => (
          <button
            key={f}
            className={filter === f ? "active" : ""}
            onClick={() => setFilter(f)}
          >
            {f || "All"} ({f ? nags.filter((n) => n.status === f).length : nags.length})
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {filtered.length === 0 ? (
        <p>No nags found.</p>
      ) : (
        <div className="card-list">
          {filtered.map((nag) => {
            const isOpen = nag.status === "open";
            return (
              <div key={nag.id} className={`card${isOpen ? "" : " card-done"}`}>
                <div className="card-header">
                  <div>
                    <span className="badge badge-category">{nag.category}</span>
                    {!isOpen && (
                      <span className={`badge badge-${statusLabel(nag.status)}`}>
                        {statusLabel(nag.status)}
                      </span>
                    )}
                    <span className="card-from">
                      from {getName(nag.creator_id)}
                    </span>
                  </div>
                  <span className="due-date">
                    Due: {new Date(nag.due_at).toLocaleString()}
                  </span>
                </div>
                {nag.description && (
                  <p className="card-description">{nag.description}</p>
                )}
                {isOpen && (
                  <div className="card-actions">
                    {nag.recipient_id === userId ? (
                      <>
                        <button onClick={() => markComplete(nag.id)}>
                          Mark Complete
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => setExcuseNagId(nag.id)}
                        >
                          Submit Excuse
                        </button>
                      </>
                    ) : (
                      <>
                        <button disabled title="Only the recipient can mark this complete">
                          Mark Complete
                        </button>
                        <button disabled className="btn-secondary" title="Only the recipient can submit an excuse">
                          Submit Excuse
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

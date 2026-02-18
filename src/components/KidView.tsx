import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance, extractErrorMessage } from "../api/axios-instance";
import type { NagResponse } from "../api/model";
import { CreateNagModal } from "./CreateNag";

export default function KidView() {
  const { userId, logout } = useAuth();
  const { getName, members, loading: membersLoading } = useMembers();
  const [searchParams] = useSearchParams();
  const viewUserId = searchParams.get("user") ?? userId;
  const isOwnView = viewUserId === userId;
  const familyId = localStorage.getItem("nagz_family_id");
  const myRole = members.find((m) => m.user_id === userId)?.role;
  const [nags, setNags] = useState<NagResponse[]>([]);
  const [excuses, setExcuses] = useState<Record<string, { summary: string; at: string }[]>>({});
  const [escalations, setEscalations] = useState<Record<string, { current_phase: string; computed_at: string }>>({});
  const [recomputing, setRecomputing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("open");

  // Create nag modal state
  const [showCreateNag, setShowCreateNag] = useState(false);

  // Excuse modal state
  const [excuseNagId, setExcuseNagId] = useState<string | null>(null);
  const [excuseText, setExcuseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [snoozing, setSnoozing] = useState<string | null>(null);

  const loadNags = async () => {
    if (!familyId) return;
    try {
      const resp = await customInstance<{ items: NagResponse[]; total: number }>({
        url: "/api/v1/nags",
        method: "GET",
        params: { family_id: familyId },
      });
      const userNags = (resp.items ?? []).filter((n) => n.recipient_id === viewUserId);
      setNags(userNags);

      // Fetch excuses for all nags in parallel
      const excuseMap: Record<string, { summary: string; at: string }[]> = {};
      const results = await Promise.allSettled(
        userNags.map((n) =>
          customInstance<{ items: { summary: string; at: string }[] }>({
            url: `/api/v1/nags/${n.id}/excuses`,
            method: "GET",
          })
        )
      );
      for (let i = 0; i < userNags.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled" && (r.value.items ?? []).length > 0) {
          excuseMap[userNags[i].id] = r.value.items;
        }
      }
      setExcuses(excuseMap);

      // Fetch escalation for open nags
      const openNags = userNags.filter((n) => n.status === "open");
      const escResults = await Promise.allSettled(
        openNags.map((n) =>
          customInstance<{ current_phase: string; computed_at: string }>({
            url: `/api/v1/nags/${n.id}/escalation`,
            method: "GET",
          })
        )
      );
      const escMap: Record<string, { current_phase: string; computed_at: string }> = {};
      for (let i = 0; i < openNags.length; i++) {
        const r = escResults[i];
        if (r.status === "fulfilled") {
          escMap[openNags[i].id] = r.value;
        }
      }
      setEscalations(escMap);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to load nagz"));
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
      setError(extractErrorMessage(err, "Failed to mark nag as complete"));
    }
  };

  const recomputeEscalation = async (nagId: string) => {
    setRecomputing(nagId);
    try {
      const result = await customInstance<{ current_phase: string; computed_at: string }>({
        url: `/api/v1/nags/${nagId}/escalation/recompute`,
        method: "POST",
      });
      setEscalations((prev) => ({ ...prev, [nagId]: result }));
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to recompute escalation"));
    }
    setRecomputing(null);
  };

  const snoozeNag = async (nagId: string, minutes: number) => {
    setSnoozing(nagId);
    setError("");
    try {
      const nag = nags.find((n) => n.id === nagId);
      if (!nag) return;
      const newDue = new Date(new Date(nag.due_at).getTime() + minutes * 60_000).toISOString();
      await customInstance<NagResponse>({
        url: `/api/v1/nags/${nagId}`,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: { due_at: newDue },
      });
      await loadNags();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to snooze nag"));
    }
    setSnoozing(null);
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
      await loadNags();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to submit excuse"));
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

  if (loading || membersLoading) return <p>Loading nagz...</p>;

  const filtered = filter
    ? nags.filter((n) => n.status === filter)
    : nags;

  const statusLabel = (s: string) =>
    s.startsWith("cancelled") ? "cancelled" : s;

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

  const escalationColor = (p: string) => {
    const map: Record<string, string> = {
      phase_0_initial: "#6b7280",
      phase_1_due_soon: "#eab308",
      phase_2_overdue_soft: "#f97316",
      phase_3_overdue_bounded_pushback: "#ef4444",
      phase_4_guardian_review: "#7c3aed",
    };
    return map[p] ?? "#6b7280";
  };

  return (
    <div>
      <div className="header">
        <h2>{getName(viewUserId!)}'s Nagz</h2>
        <div className="header-actions">
          <span className="logged-in-as">{getName(userId!)}</span>
          {myRole !== "child" && <Link to="/nags">Nagz</Link>}
          {myRole !== "child" && <Link to="/">Family</Link>}
          <Link to="/leaderboard">Leaderboard</Link>
          <button onClick={logout} className="link-button">Logout</button>
        </div>
      </div>

      <p className="page-hint">
        {isOwnView
          ? myRole === "child"
            ? "These are your nagz. Mark them complete when done, or submit an excuse if you can't finish."
            : "Your nagz. Use the Family page to see all members and create nagz."
          : `Viewing ${getName(viewUserId!)}'s nagz. Only they can mark them complete or submit excuses.`}
      </p>

      {myRole !== "child" && familyId && (
        <div style={{ marginBottom: "1rem" }}>
          <button className="btn-create" onClick={() => setShowCreateNag(true)}>
            + Create Nag for {getName(viewUserId!)}
          </button>
        </div>
      )}

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
        <p>No nagz found.</p>
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
                {escalations[nag.id] && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                    <span className="badge" style={{ backgroundColor: escalationColor(escalations[nag.id].current_phase) }}>
                      {formatPhase(escalations[nag.id].current_phase)}
                    </span>
                    {myRole === "guardian" && (
                      <button
                        className="link-button"
                        style={{ fontSize: "0.8rem" }}
                        onClick={() => recomputeEscalation(nag.id)}
                        disabled={recomputing === nag.id}
                      >
                        {recomputing === nag.id ? "..." : "Recompute"}
                      </button>
                    )}
                  </div>
                )}
                {nag.description && (
                  <p className="card-description">{nag.description}</p>
                )}
                {excuses[nag.id] && excuses[nag.id].length > 0 && (
                  <div className="excuse-list">
                    <span className="excuse-heading">
                      Excuses ({excuses[nag.id].length})
                    </span>
                    {excuses[nag.id].map((ex, i) => (
                      <div key={i} className="excuse-item">
                        <span className="excuse-text">{ex.summary}</span>
                        <span className="excuse-time">
                          {new Date(ex.at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
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
                        <button
                          className="btn-secondary"
                          onClick={() => snoozeNag(nag.id, 15)}
                          disabled={snoozing === nag.id}
                          title="Snooze for 15 minutes"
                        >
                          {snoozing === nag.id ? "..." : "Snooze 15m"}
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

      {showCreateNag && familyId && (
        <CreateNagModal
          familyId={familyId}
          recipientId={viewUserId ?? undefined}
          onClose={() => setShowCreateNag(false)}
          onCreated={() => {
            setShowCreateNag(false);
            loadNags();
          }}
        />
      )}
    </div>
  );
}

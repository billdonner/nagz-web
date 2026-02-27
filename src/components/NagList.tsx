import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { customInstance, extractErrorMessage } from "../api/axios-instance";
import { useMembers } from "../members";
import { CATEGORIES, DONE_DEFS, formatPhase, statusLabel, urgencyTier, URGENCY_COLORS, URGENCY_BORDER } from "../nag-utils";
import type { NagResponse } from "../api/model";
import { CreateNagModal } from "./CreateNag";
import { useWebSocket } from "../hooks/useWebSocket";

export default function NagList() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const [nags, setNags] = useState<NagResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [sortCol, setSortCol] = useState<"category" | "status" | "to" | "from" | "due">("due");
  const [sortAsc, setSortAsc] = useState(true);
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
  const { eventCount } = useWebSocket(familyId);

  const loadNags = async () => {
    if (!familyId) return;
    setError("");
    try {
      const params: Record<string, string> = { family_id: familyId };
      if (filter) params.state = filter;
      const resp = await customInstance<{ items: NagResponse[]; total: number }>({
        url: "/api/v1/nags",
        method: "GET",
        params,
      });
      setNags(resp.items ?? []);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to load nagz"));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadNags();
  }, [familyId, filter]);

  // Auto-refresh when WebSocket events arrive
  useEffect(() => {
    if (eventCount > 0) loadNags();
  }, [eventCount]);

  useEffect(() => {
    if (!detailNag || detailNag.status !== "open") {
      setDetailEscalation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const esc = await customInstance<{ current_phase: string }>({
          url: `/api/v1/nags/${detailNag.id}/escalation`,
          method: "GET",
        });
        if (!cancelled) setDetailEscalation(esc);
      } catch (err) {
        console.error("Failed to load escalation:", err);
        if (!cancelled) setDetailEscalation(null);
      }
    })();
    return () => { cancelled = true; };
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
      setEditError(extractErrorMessage(err, "Failed to recompute"));
    }
    setRecomputing(false);
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
      setEditError(extractErrorMessage(err, "Failed to update nag"));
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

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const sortIndicator = (col: typeof sortCol) =>
    sortCol === col ? (sortAsc ? " \u25B2" : " \u25BC") : "";

  const sortNags = (list: NagResponse[]) => [...list].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case "category": cmp = a.category.localeCompare(b.category); break;
      case "status": cmp = a.status.localeCompare(b.status); break;
      case "to": cmp = (a.recipient_display_name ?? getName(a.recipient_id)).localeCompare(b.recipient_display_name ?? getName(b.recipient_id)); break;
      case "from": cmp = (a.creator_display_name ?? getName(a.creator_id)).localeCompare(b.creator_display_name ?? getName(b.creator_id)); break;
      case "due": cmp = new Date(a.due_at).getTime() - new Date(b.due_at).getTime(); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const nagsForMe = nags.filter((n) => n.recipient_id === userId);
  const nagsForOthers = nags.filter((n) => n.recipient_id !== userId);

  return (
    <div>
      <div className="header">
        <h2>Nagz</h2>
        <div className="header-actions">
          <Link to="/">Family</Link>
          <Link to="/connections">People</Link>
          <Link to="/leaderboard">Leaderboard</Link>
          <span className="logged-in-as">{getName(userId ?? "")}</span>
          <button onClick={logout} className="link-button">Logout</button>
        </div>
      </div>

      <div className="filters">
        {[
          { key: "", label: "All" },
          { key: "open", label: "Open" },
          { key: "completed", label: "Done" },
          { key: "missed", label: "Missed" },
        ].map((f) => (
          <button key={f.key} className={filter === f.key ? "active" : ""} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <button className="btn-create" style={{ marginLeft: "auto" }} onClick={() => setShowCreate(true)}>+ New Nag</button>
      </div>

      {nags.length === 0 ? (
        <p>No nagz found.</p>
      ) : (
        <>
          {nagsForMe.length > 0 && (
            <>
              <h3 style={{ margin: "1rem 0 0.5rem" }}>For Me</h3>
              <table className="compact-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => toggleSort("category")}>Nag{sortIndicator("category")}</th>
                    <th className="sortable" onClick={() => toggleSort("status")}>Status{sortIndicator("status")}</th>
                    <th className="sortable" onClick={() => toggleSort("from")}>From{sortIndicator("from")}</th>
                    <th className="sortable" onClick={() => toggleSort("due")}>Due{sortIndicator("due")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortNags(nagsForMe).map((nag) => {
                    const tier = urgencyTier(nag.due_at, nag.status);
                    const borderColor = URGENCY_BORDER[tier];
                    const dueColor = URGENCY_COLORS[tier];
                    return (
                    <tr key={nag.id} onClick={() => setDetailNag(nag)} style={{ cursor: "pointer", borderLeft: borderColor ? `3px solid ${borderColor}` : undefined }}>
                      <td>
                        <span className="nag-cat">{nag.category}</span>
                        {nag.recurrence && <span className="nag-repeat" title={nag.recurrence}>&#x1F501;</span>}
                        {nag.description && <span className="nag-desc">{nag.description}</span>}
                      </td>
                      <td>
                        <span className={`badge badge-${statusLabel(nag.status)}`}>
                          {statusLabel(nag.status)}
                        </span>
                      </td>
                      <td>{nag.creator_display_name ?? getName(nag.creator_id)}</td>
                      <td className="due-cell" style={dueColor ? { color: dueColor } : undefined}>{new Date(nag.due_at).toLocaleDateString()}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {nagsForOthers.length > 0 && (
            <>
              <h3 style={{ margin: "1rem 0 0.5rem" }}>Nagz to Others:</h3>
              <table className="compact-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => toggleSort("category")}>Nag{sortIndicator("category")}</th>
                    <th className="sortable" onClick={() => toggleSort("status")}>Status{sortIndicator("status")}</th>
                    <th className="sortable" onClick={() => toggleSort("to")}>To{sortIndicator("to")}</th>
                    <th className="sortable" onClick={() => toggleSort("due")}>Due{sortIndicator("due")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortNags(nagsForOthers).map((nag) => {
                    const tier = urgencyTier(nag.due_at, nag.status);
                    const borderColor = URGENCY_BORDER[tier];
                    const dueColor = URGENCY_COLORS[tier];
                    return (
                    <tr key={nag.id} onClick={() => setDetailNag(nag)} style={{ cursor: "pointer", borderLeft: borderColor ? `3px solid ${borderColor}` : undefined }}>
                      <td>
                        <span className="nag-cat">{nag.category}</span>
                        {nag.recurrence && <span className="nag-repeat" title={nag.recurrence}>&#x1F501;</span>}
                        {nag.description && <span className="nag-desc">{nag.description}</span>}
                      </td>
                      <td>
                        <span className={`badge badge-${statusLabel(nag.status)}`}>
                          {statusLabel(nag.status)}
                        </span>
                      </td>
                      <td>{nag.recipient_display_name ?? getName(nag.recipient_id)}</td>
                      <td className="due-cell" style={dueColor ? { color: dueColor } : undefined}>{new Date(nag.due_at).toLocaleDateString()}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </>
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
              <dd>{detailNag.recipient_display_name ?? getName(detailNag.recipient_id)}</dd>
              <dt>From</dt>
              <dd>{detailNag.creator_display_name ?? getName(detailNag.creator_id)}</dd>
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
              {detailNag.recurrence && (
                <>
                  <dt>Repeats</dt>
                  <dd>{detailNag.recurrence.charAt(0).toUpperCase() + detailNag.recurrence.slice(1)}</dd>
                </>
              )}
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
                <button
                  className="btn-secondary"
                  onClick={() => navigate(`/deliveries?nag_id=${detailNag.id}`)}
                >
                  Deliveries
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

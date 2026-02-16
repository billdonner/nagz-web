import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { customInstance } from "../api/axios-instance";
import { useMembers } from "../members";
import type { NagResponse } from "../api/model";

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  completed: "#22c55e",
  missed: "#ef4444",
  cancelled_relationship_change: "#6b7280",
};

export default function NagList() {
  const { userId, logout } = useAuth();
  const [nags, setNags] = useState<NagResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [detailNag, setDetailNag] = useState<NagResponse | null>(null);
  const { getName, loading: membersLoading } = useMembers();

  const familyId = localStorage.getItem("nagz_family_id");

  useEffect(() => {
    if (!familyId) return;
    const load = async () => {
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
    load();
  }, [familyId, filter]);

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
            </dl>
            <button onClick={() => setDetailNag(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

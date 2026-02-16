import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  const [nags, setNags] = useState<NagResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("");
  const { getName } = useMembers();

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
        setError("Failed to load nags");
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

  if (loading) return <p>Loading nags...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <div className="header">
        <h2>All Nags</h2>
        <Link to="/">Family</Link>
      </div>

      <p className="page-hint">
        All nags across the family. Use the filters to show only open, completed, or missed nags.
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
        <p>No nags found.</p>
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
              <tr key={nag.id} title={nag.description ?? undefined}>
                <td>
                  {nag.category}
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
                    {nag.status.startsWith("cancelled") ? "cancelled" : nag.status}
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
    </div>
  );
}

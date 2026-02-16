import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { customInstance } from "../api/axios-instance";
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
        <p>No family selected. <Link to="/">Go to dashboard</Link></p>
      </div>
    );
  }

  if (loading) return <p>Loading nags...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <div className="header">
        <h2>All Nags</h2>
        <Link to="/" className="btn-secondary">Back</Link>
      </div>

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
              <th>Due</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {nags.map((nag) => (
              <tr key={nag.id}>
                <td>{nag.category}</td>
                <td>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: STATUS_COLORS[nag.status] ?? "#6b7280",
                    }}
                  >
                    {nag.status}
                  </span>
                </td>
                <td>{nag.recipient_id.slice(0, 8)}...</td>
                <td>{new Date(nag.due_at).toLocaleString()}</td>
                <td>{new Date(nag.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

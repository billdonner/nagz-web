import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance } from "../api/axios-instance";
import type { NagResponse } from "../api/model";

export default function FamilyDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const { members, familyName, reload: reloadMembers } = useMembers();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualFamilyId, setManualFamilyId] = useState("");
  const [nagCounts, setNagCounts] = useState<Record<string, number>>({});

  const loadFamily = async (fid: string) => {
    setLoading(true);
    setError("");
    try {
      const nags = await customInstance<NagResponse[]>({
        url: "/api/v1/nags",
        method: "GET",
        params: { family_id: fid },
      });
      setFamilyId(fid);
      localStorage.setItem("nagz_family_id", fid);
      reloadMembers();

      // Count nags per recipient
      const counts: Record<string, number> = {};
      for (const n of nags) {
        counts[n.recipient_id] = (counts[n.recipient_id] ?? 0) + 1;
      }
      setNagCounts(counts);
    } catch {
      setError("Could not access family. Check the family ID.");
    }
    setLoading(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem("nagz_family_id");
    if (saved) {
      loadFamily(saved);
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <p>Loading...</p>;

  if (!familyId) {
    return (
      <div>
        <div className="header">
          <h2>Family Dashboard</h2>
          <button onClick={logout} className="btn-secondary">
            Logout
          </button>
        </div>
        <p>Enter your family ID to get started:</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualFamilyId.trim()) loadFamily(manualFamilyId.trim());
          }}
        >
          <input
            type="text"
            placeholder="family-uuid"
            value={manualFamilyId}
            onChange={(e) => setManualFamilyId(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit">Load Family</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="header">
        <h2>{familyName ?? "Family Dashboard"}</h2>
        <button onClick={logout} className="btn-secondary">
          Logout
        </button>
      </div>

      <nav className="nav-links">
        <Link to="/nags">All Nags</Link>
      </nav>

      {members.length > 0 && (
        <div>
          <h3>Members</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Nagz</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const count = nagCounts[m.user_id] ?? 0;
                return (
                  <tr
                    key={m.user_id}
                    className={m.user_id === userId ? "row-highlight" : ""}
                  >
                    <td>
                      <button
                        className="link-button"
                        onClick={() =>
                          navigate(`/create-nag?recipient=${m.user_id}`)
                        }
                      >
                        {m.role === "guardian" && "* "}
                        {m.display_name ?? m.user_id.slice(0, 8)}
                      </button>
                      {m.user_id === userId && (
                        <span className="you-badge">you</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="badge badge-nag-count badge-clickable"
                        onClick={() => navigate(`/kid?user=${m.user_id}`)}
                      >
                        {count}
                      </button>
                    </td>
                    <td>{new Date(m.joined_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

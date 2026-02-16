import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { customInstance } from "../api/axios-instance";
import type { MemberResponse } from "../api/model";

export default function FamilyDashboard() {
  const { userId, logout } = useAuth();
  const [members] = useState<MemberResponse[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // The API doesn't have a direct "list my families" endpoint.
    // We use the preferences endpoint to discover the family_id,
    // then list members. If no family found, show a message.
    const load = async () => {
      try {
        // Try to get preferences which reveals family_id
        const prefs = await customInstance<{ family_id: string }>({
          url: "/api/v1/preferences",
          method: "GET",
          params: { family_id: "" },
        });
        if (prefs.family_id) {
          setFamilyId(prefs.family_id);
        }
      } catch {
        // Preferences might fail if no family. Try listing nags to discover family.
      }

      // If we got a family_id from prefs, try to list nags to find members
      // Otherwise we need the user to provide family_id
      setLoading(false);
    };
    load();
  }, [userId]);

  // Allow user to manually enter family_id for now
  const [manualFamilyId, setManualFamilyId] = useState("");

  const loadFamily = async (fid: string) => {
    setLoading(true);
    setError("");
    try {
      // List nags for this family to confirm access
      const nags = await customInstance<unknown[]>({
        url: "/api/v1/nags",
        method: "GET",
        params: { family_id: fid },
      });
      setFamilyId(fid);
      localStorage.setItem("nagz_family_id", fid);

      // We can infer members from nag creator/recipient IDs
      // But for a proper member list we'd need to call the families endpoint
      // For now, store the family_id and proceed
      void nags;
    } catch (err) {
      setError("Could not access family. Check the family ID.");
    }
    setLoading(false);
  };

  // On mount, try saved family_id
  useEffect(() => {
    const saved = localStorage.getItem("nagz_family_id");
    if (saved) loadFamily(saved);
  }, []);

  if (loading) return <p>Loading...</p>;

  if (!familyId) {
    return (
      <div>
        <div className="header">
          <h2>Family Dashboard</h2>
          <button onClick={logout} className="btn-secondary">Logout</button>
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
        <h2>Family Dashboard</h2>
        <div>
          <span className="badge">Family: {familyId.slice(0, 8)}...</span>
          <button onClick={logout} className="btn-secondary">Logout</button>
        </div>
      </div>

      <nav className="nav-links">
        <Link to="/nags">All Nags</Link>
        <Link to="/create-nag">Create Nag</Link>
        <Link to="/kid">Kid View</Link>
      </nav>

      {members.length > 0 && (
        <div>
          <h3>Members</h3>
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>{m.user_id.slice(0, 8)}...</td>
                  <td>
                    <span className={`badge badge-${m.role}`}>{m.role}</span>
                  </td>
                  <td>{m.status}</td>
                  <td>{new Date(m.joined_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

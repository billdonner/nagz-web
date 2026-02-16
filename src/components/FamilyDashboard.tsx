import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance } from "../api/axios-instance";
import type { NagResponse } from "../api/model";
import axios from "axios";
import { CreateNagModal } from "./CreateNag";
import { MemberSettings } from "./MemberSettings";

export default function FamilyDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const { members, familyName, getName, reload: reloadMembers } = useMembers();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualFamilyId, setManualFamilyId] = useState("");
  const [nagCounts, setNagCounts] = useState<Record<string, number>>({});

  // Create nag modal
  const [createNagRecipient, setCreateNagRecipient] = useState<string | null>(null);
  // Member settings modal
  const [settingsMemberId, setSettingsMemberId] = useState<string | null>(null);

  // Add member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("child");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

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

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !familyId) return;
    setAdding(true);
    setAddError("");
    try {
      await customInstance<unknown>({
        url: `/api/v1/families/${familyId}/members/create`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { display_name: newName.trim(), role: newRole },
      });
      setNewName("");
      setNewRole("child");
      setShowAddForm(false);
      reloadMembers();
      await loadFamily(familyId);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg =
          err.response?.data?.detail ?? err.response?.data?.error?.message;
        setAddError(msg ?? "Failed to add member.");
      } else {
        setAddError("Failed to add member.");
      }
    }
    setAdding(false);
  };

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
        <div className="header-actions">
          <Link to="/nags">Nagz</Link>
          <Link to="/leaderboard">Leaderboard</Link>
          <span className="logged-in-as">{getName(userId!)}</span>
          <button onClick={logout} className="link-button">
            Logout
          </button>
        </div>
      </div>

      <p className="page-hint">
        Tap a name to view their nagz. Tap the count to create one for them. * = guardian.
      </p>

      {members.length > 0 && (
        <div>
          <h3>Members</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Nagz</th>
                <th>Settings</th>
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
                        onClick={() => navigate(`/kid?user=${m.user_id}`)}
                      >
                        {m.role === "guardian" && "* "}
                        {m.display_name ?? m.user_id.slice(0, 8)}
                      </button>
                    </td>
                    <td>
                      <button
                        className="badge badge-nag-count badge-clickable"
                        onClick={() => setCreateNagRecipient(m.user_id)}
                      >
                        {count}
                      </button>
                    </td>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => setSettingsMemberId(m.user_id)}
                        title="Settings"
                      >
                        Settings
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {createNagRecipient && familyId && (
        <CreateNagModal
          familyId={familyId}
          recipientId={createNagRecipient}
          onClose={() => setCreateNagRecipient(null)}
          onCreated={() => {
            setCreateNagRecipient(null);
            loadFamily(familyId);
          }}
        />
      )}

      {settingsMemberId && familyId && (
        <MemberSettings
          userId={settingsMemberId}
          familyId={familyId}
          displayName={getName(settingsMemberId)}
          onClose={() => setSettingsMemberId(null)}
          onSaved={() => setSettingsMemberId(null)}
        />
      )}

      {showAddForm ? (
        <form onSubmit={handleAddMember} className="form add-member-form">
          <h3>Add Member</h3>
          <label>
            Name
            <input
              type="text"
              placeholder="Display name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Role
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="child">Child</option>
              <option value="guardian">Guardian</option>
            </select>
          </label>
          {addError && <p className="error">{addError}</p>}
          <div className="card-actions">
            <button type="submit" disabled={adding}>
              {adding ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setShowAddForm(false);
                setAddError("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          className="link-button"
          onClick={() => setShowAddForm(true)}
          style={{ marginTop: "1rem" }}
        >
          + Add family member
        </button>
      )}
    </div>
  );
}

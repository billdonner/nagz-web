import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance, extractErrorMessage } from "../api/axios-instance";
import type { NagResponse } from "../api/model";
import { UUID_DISPLAY_LENGTH } from "../nag-utils";
import { CreateNagModal } from "./CreateNag";
import { MemberSettings } from "./MemberSettings";
import { ChildSettings } from "./ChildSettings";

export default function FamilyDashboard() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const { members, familyName, inviteCode, childCode, getName, reload: reloadMembers } = useMembers();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualFamilyId, setManualFamilyId] = useState("");
  const [nagCounts, setNagCounts] = useState<Record<string, number>>({});
  const myRole = members.find((m) => m.user_id === userId)?.role;
  const isAdmin = myRole === "guardian";

  // Create nag modal
  const [createNagRecipient, setCreateNagRecipient] = useState<string | null>(null);
  // Member settings modal
  const [settingsMemberId, setSettingsMemberId] = useState<string | null>(null);
  // Child controls modal
  const [childControlsTarget, setChildControlsTarget] = useState<{ id: string; name: string } | null>(null);
  // Set credentials modal
  const [credTarget, setCredTarget] = useState<{ id: string; name: string } | null>(null);
  const [credUsername, setCredUsername] = useState("");
  const [credPin, setCredPin] = useState("");
  const [credError, setCredError] = useState("");
  const [credSaving, setCredSaving] = useState(false);

  // Add member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("child");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadFamily = async (fid: string) => {
    setLoading(true);
    setError("");
    try {
      const nagsResp = await customInstance<{ items: NagResponse[]; total: number }>({
        url: "/api/v1/nags",
        method: "GET",
        params: { family_id: fid },
      });
      const nags = nagsResp.items ?? [];
      setFamilyId(fid);
      localStorage.setItem("nagz_family_id", fid);
      reloadMembers();

      // Count nags per recipient
      const counts: Record<string, number> = {};
      for (const n of nags) {
        counts[n.recipient_id] = (counts[n.recipient_id] ?? 0) + 1;
      }
      setNagCounts(counts);

    } catch (err) {
      setError(extractErrorMessage(err, "Could not access family. Check the family ID."));
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
      setAddError(extractErrorMessage(err, "Failed to add member."));
    }
    setAdding(false);
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!familyId) return;
    if (!confirm(`Remove ${memberName} from the family? Their open nags will be cancelled.`)) return;
    setRemoving(memberId);
    try {
      await customInstance<unknown>({
        url: `/api/v1/families/${familyId}/members/${memberId}`,
        method: "DELETE",
      });
      reloadMembers();
      await loadFamily(familyId);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to remove member."));
    }
    setRemoving(null);
  };

  const handleSuspendRelationship = async (memberId: string, memberName: string) => {
    if (!confirm(`Suspend relationship with ${memberName}? They won't be able to create or receive nags.`)) return;
    setError("");
    try {
      // Find the relationship between current user and target
      await customInstance<{ id: string }>({
        url: `/api/v1/relationships/${memberId}/suspend`,
        method: "POST",
      });
      setError("");
      alert(`Relationship with ${memberName} has been suspended.`);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to suspend relationship."));
    }
  };

  const handleSaveCredentials = async () => {
    if (!familyId || !credTarget) return;
    if (!credUsername.trim()) {
      setCredError("Username is required.");
      return;
    }
    if (!/^\d{4}$/.test(credPin)) {
      setCredError("PIN must be exactly 4 digits.");
      return;
    }
    setCredSaving(true);
    setCredError("");
    try {
      await customInstance({
        url: `/api/v1/families/${familyId}/members/${credTarget.id}/credentials`,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        data: { username: credUsername.trim(), pin: credPin },
      });
      setCredTarget(null);
      setCredUsername("");
      setCredPin("");
      reloadMembers();
    } catch (err) {
      setCredError(extractErrorMessage(err, "Failed to set credentials."));
    }
    setCredSaving(false);
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
          <Link to="/connections">People</Link>
          <Link to="/leaderboard">Leaderboard</Link>
          {isAdmin && <Link to="/reports">Reports</Link>}
          {isAdmin && <Link to="/consents">Consents</Link>}
          {isAdmin && <Link to="/incentive-rules">Incentives</Link>}
          {isAdmin && <Link to="/policies">Policies</Link>}
          <Link to="/safety">Safety</Link>
          <span className="logged-in-as">{getName(userId ?? "")}</span>
          <button onClick={logout} className="link-button">
            Logout
          </button>
        </div>
      </div>

      <p className="page-hint">
        Tap a name to view their nagz. Tap the count to create one for them.
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
                {isAdmin && <th>Child</th>}
                <th></th>
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
                        {m.display_name ?? m.user_id.slice(0, UUID_DISPLAY_LENGTH)}
                        {m.role !== "child" && ` (${m.role})`}
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
                    {isAdmin && (
                      <td>
                        {m.role === "child" && (
                          <span style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <button
                              className="link-button"
                              onClick={() => {
                                setCredTarget({ id: m.user_id, name: m.display_name ?? "Child" });
                                setCredUsername("");
                                setCredPin("");
                                setCredError("");
                              }}
                              style={{ fontSize: "0.8rem" }}
                            >
                              Login
                            </button>
                            <button
                              className="link-button"
                              onClick={() => setChildControlsTarget({ id: m.user_id, name: m.display_name ?? "Child" })}
                              style={{ fontSize: "0.8rem" }}
                            >
                              Controls
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                    <td>
                      {isAdmin && m.user_id !== userId && (
                        <span style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            className="link-button"
                            style={{ color: "#f97316" }}
                            onClick={() => handleSuspendRelationship(m.user_id, m.display_name ?? m.user_id.slice(0, UUID_DISPLAY_LENGTH))}
                          >
                            Suspend
                          </button>
                          {m.role !== "guardian" && (
                            <button
                              className="link-button"
                              style={{ color: "#ef4444" }}
                              onClick={() => handleRemoveMember(m.user_id, m.display_name ?? m.user_id.slice(0, UUID_DISPLAY_LENGTH))}
                              disabled={removing === m.user_id}
                            >
                              {removing === m.user_id ? "..." : "Remove"}
                            </button>
                          )}
                        </span>
                      )}
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

      {(inviteCode || childCode) && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", margin: "1rem 0" }}>
          {inviteCode && (
            <div className="invite-code-section" style={{ flex: 1, minWidth: "200px", margin: 0, padding: "0.75rem 1rem", background: "#f0f9ff", borderRadius: "8px", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>Invite Code:</span>
              <code style={{ fontFamily: "monospace", fontSize: "1.1rem", letterSpacing: "0.05em" }}>{inviteCode}</code>
              <button
                className="link-button"
                onClick={() => navigator.clipboard.writeText(inviteCode).catch(() => {})}
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
          )}
          {childCode && (
            <div style={{ flex: 1, minWidth: "200px", padding: "0.75rem 1rem", background: "#fef3c7", borderRadius: "8px", border: "1px solid #fde68a", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontWeight: 600 }}>Kid Login Code:</span>
              <code style={{ fontFamily: "monospace", fontSize: "1.1rem", letterSpacing: "0.15em", fontWeight: 700 }}>{childCode}</code>
              <button
                className="link-button"
                onClick={() => navigator.clipboard.writeText(childCode).catch(() => {})}
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
          )}
        </div>
      )}

      {isAdmin && (showAddForm ? (
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
              <option value="participant">Participant</option>
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
      ))}

      {credTarget && (
        <div className="modal-overlay" onClick={() => setCredTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Set Login for {credTarget.name}</h3>
            <div className="form">
              <label>
                Username
                <input
                  type="text"
                  placeholder="Username"
                  value={credUsername}
                  onChange={(e) => setCredUsername(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoFocus
                />
              </label>
              <label>
                4-Digit PIN
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="0000"
                  value={credPin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setCredPin(v);
                  }}
                  maxLength={4}
                  style={{ textAlign: "center", letterSpacing: "0.3em" }}
                />
              </label>
              {credError && <p className="error">{credError}</p>}
              <div className="card-actions">
                <button onClick={handleSaveCredentials} disabled={credSaving}>
                  {credSaving ? "Saving..." : "Save"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setCredTarget(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {childControlsTarget && familyId && (
        <ChildSettings
          familyId={familyId}
          childUserId={childControlsTarget.id}
          childName={childControlsTarget.name}
          onClose={() => setChildControlsTarget(null)}
        />
      )}
    </div>
  );
}

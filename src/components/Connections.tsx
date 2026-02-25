import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { customInstance, extractErrorMessage } from "../api/axios-instance";

interface ConnectionResponse {
  id: string;
  inviter_id: string;
  invitee_id: string | null;
  invitee_email: string;
  status: string;
  trusted: boolean;
  created_at: string;
  responded_at: string | null;
}

interface PaginatedConnections {
  items: ConnectionResponse[];
  total: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Connections() {
  const { logout } = useAuth();

  const [active, setActive] = useState<ConnectionResponse[]>([]);
  const [inbound, setInbound] = useState<ConnectionResponse[]>([]);
  const [sent, setSent] = useState<ConnectionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const loadConnections = useCallback(async () => {
    setError("");
    try {
      const [activeResp, inboundResp, allPendingResp] = await Promise.all([
        customInstance<PaginatedConnections>({
          url: "/api/v1/connections",
          method: "GET",
          params: { status: "active" },
        }),
        customInstance<PaginatedConnections>({
          url: "/api/v1/connections/pending",
          method: "GET",
        }),
        customInstance<PaginatedConnections>({
          url: "/api/v1/connections",
          method: "GET",
          params: { status: "pending" },
        }),
      ]);

      setActive(activeResp.items ?? []);
      setInbound(inboundResp.items ?? []);

      const inboundIds = new Set((inboundResp.items ?? []).map((c) => c.id));
      setSent((allPendingResp.items ?? []).filter((c) => !inboundIds.has(c.id)));
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to load connections"));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");
    try {
      await customInstance({
        url: "/api/v1/connections/invite",
        method: "POST",
        data: { invitee_email: inviteEmail.trim().toLowerCase() },
      });
      setInviteSuccess(inviteEmail.trim());
      setInviteEmail("");
      await loadConnections();
    } catch (err) {
      setInviteError(extractErrorMessage(err, "Failed to send invite"));
    }
    setInviting(false);
  };

  const handleShare = async () => {
    const message = `I invited you to Nagz! Download the app and sign up with ${inviteSuccess} so we can stay connected. https://nagz.online`;
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
      } catch {
        // User cancelled share — ignore
      }
    } else {
      await navigator.clipboard.writeText(message);
      alert("Invite message copied to clipboard!");
    }
    setInviteSuccess("");
  };

  const handleAccept = async (id: string) => {
    try {
      await customInstance({
        url: `/api/v1/connections/${id}/accept`,
        method: "POST",
      });
      await loadConnections();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to accept"));
    }
  };

  const handleDecline = async (id: string) => {
    try {
      await customInstance({
        url: `/api/v1/connections/${id}/decline`,
        method: "POST",
      });
      await loadConnections();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to decline"));
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await customInstance({
        url: `/api/v1/connections/${id}/revoke`,
        method: "POST",
      });
      await loadConnections();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to revoke"));
    }
  };

  const handleToggleTrust = async (id: string, currentTrusted: boolean) => {
    try {
      await customInstance<ConnectionResponse>({
        url: `/api/v1/connections/${id}/trust`,
        method: "PATCH",
        data: { trusted: !currentTrusted },
      });
      await loadConnections();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to update trust"));
    }
  };

  if (loading) return <p>Loading connections...</p>;

  return (
    <div>
      <div className="header">
        <h2>People</h2>
        <div className="header-actions">
          <Link to="/">Home</Link>
          <Link to="/nags">Nagz</Link>
          <button onClick={logout} className="link-button">
            Logout
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Invite Form / Success */}
      <div className="section">
        <h3>Invite Someone</h3>
        {inviteSuccess ? (
          <div className="invite-success">
            <p>
              <strong>Invite sent to {inviteSuccess}!</strong>
            </p>
            <p className="hint">Let them know to download Nagz and sign up.</p>
            <div className="card-actions">
              <button onClick={handleShare}>
                {typeof navigator.share === "function" ? "Share Invite" : "Copy Invite Message"}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setInviteSuccess("")}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="invite-form">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={inviting || !inviteEmail.trim()}>
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </form>
        )}
        {inviteError && <p className="error">{inviteError}</p>}
      </div>

      {/* Inbound Pending Invites */}
      {inbound.length > 0 && (
        <div className="section">
          <h3>Invites for You</h3>
          <table className="compact-table">
            <thead>
              <tr>
                <th>From</th>
                <th>Sent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inbound.map((c) => (
                <tr key={c.id}>
                  <td>{c.invitee_email}</td>
                  <td>{timeAgo(c.created_at)}</td>
                  <td>
                    <button onClick={() => handleAccept(c.id)}>Accept</button>{" "}
                    <button
                      className="btn-secondary"
                      onClick={() => handleDecline(c.id)}
                    >
                      Decline
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sent Invites */}
      {sent.length > 0 && (
        <div className="section">
          <h3>Invites You Sent</h3>
          <table className="compact-table">
            <thead>
              <tr>
                <th>To</th>
                <th>Sent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sent.map((c) => (
                <tr key={c.id}>
                  <td>{c.invitee_email}</td>
                  <td>{timeAgo(c.created_at)}</td>
                  <td>
                    <button
                      className="btn-secondary"
                      onClick={() => handleRevoke(c.id)}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Active Connections */}
      <div className="section">
        <h3>Active Connections</h3>
        {active.length === 0 ? (
          <p className="hint">
            No connections yet. Invite someone by email to get started.
          </p>
        ) : (
          <table className="compact-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Connected</th>
                <th>Trusted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {active.map((c) => (
                <tr key={c.id}>
                  <td>{c.invitee_email}</td>
                  <td>{timeAgo(c.responded_at ?? c.created_at)}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={c.trusted}
                      onChange={() => handleToggleTrust(c.id, c.trusted)}
                      title={c.trusted ? "Trusted — can nag each other's kids" : "Not trusted — click to enable"}
                    />
                  </td>
                  <td>
                    <button
                      className="btn-secondary"
                      onClick={() => handleRevoke(c.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

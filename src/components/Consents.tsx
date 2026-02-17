import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance } from "../api/axios-instance";
import axios from "axios";

interface ConsentItem {
  id: string;
  user_id: string;
  family_id_nullable: string | null;
  consent_type: string;
}

const CONSENT_TYPES = [
  {
    type: "gamification_participation",
    label: "Gamification",
    description: "Enable points, streaks, and leaderboards",
  },
  {
    type: "ai_mediation",
    label: "AI Mediation",
    description: "Allow AI to mediate nag excuses and pushback",
  },
  {
    type: "sms_opt_in",
    label: "SMS Notifications",
    description: "Receive SMS notifications for nag updates",
  },
  {
    type: "child_account_creation",
    label: "Child Account Creation",
    description: "Allow creating child accounts in this family",
  },
];

export default function Consents() {
  const { userId, logout } = useAuth();
  const { getName } = useMembers();
  const familyId = localStorage.getItem("nagz_family_id");
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!familyId) return;
    setError("");
    try {
      const data = await customInstance<ConsentItem[]>({
        url: "/api/v1/consents",
        method: "GET",
        params: { family_id: familyId },
      });
      setConsents(data);
    } catch {
      setError("Failed to load consents");
    }
    setLoading(false);
  }, [familyId]);

  useEffect(() => {
    load();
  }, [load]);

  const grantConsent = async (consentType: string) => {
    if (!familyId) return;
    setUpdating(true);
    setError("");
    try {
      await customInstance({
        url: "/api/v1/consents",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { family_id: familyId, consent_type: consentType },
      });
      await load();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error?.message ?? "Failed to grant consent"
        );
      } else {
        setError("Failed to grant consent");
      }
    }
    setUpdating(false);
  };

  const revokeConsent = async (consentId: string) => {
    setUpdating(true);
    setError("");
    try {
      await customInstance({
        url: `/api/v1/consents/${consentId}`,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: { revoked: true },
      });
      await load();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error?.message ?? "Failed to revoke consent"
        );
      } else {
        setError("Failed to revoke consent");
      }
    }
    setUpdating(false);
  };

  if (!familyId) {
    return (
      <p>
        No family selected. <Link to="/">Go to dashboard</Link>
      </p>
    );
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div className="header">
        <h2>Consents</h2>
        <div className="header-actions">
          <Link to="/">Family</Link>
          <span className="logged-in-as">{getName(userId!)}</span>
          <button onClick={logout} className="link-button">
            Logout
          </button>
        </div>
      </div>

      <p className="page-hint">
        Manage consent for AI features and notifications. Grant or revoke
        consent for each feature below.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="card-list">
        {CONSENT_TYPES.map(({ type, label, description }) => {
          const granted = consents.find((c) => c.consent_type === type);
          return (
            <div key={type} className="card">
              <div className="card-header">
                <div>
                  <strong>{label}</strong>
                  <p className="card-description">{description}</p>
                </div>
                {granted ? (
                  <button
                    className="btn-danger"
                    onClick={() => revokeConsent(granted.id)}
                    disabled={updating}
                  >
                    Revoke
                  </button>
                ) : (
                  <button
                    onClick={() => grantConsent(type)}
                    disabled={updating}
                  >
                    Grant
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

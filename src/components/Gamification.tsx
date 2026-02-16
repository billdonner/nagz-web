import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance } from "../api/axios-instance";
import axios from "axios";

interface GamificationSummary {
  family_id: string;
  user_id: string;
  total_points: number;
  current_streak: number;
  event_count: number;
}

interface LeaderboardEntry {
  user_id: string;
  total_points: number;
}

interface LeaderboardResponse {
  family_id: string;
  period_start: string;
  leaderboard: LeaderboardEntry[];
}

interface GamificationEventItem {
  id: string;
  family_id: string;
  user_id: string;
  event_type: string;
  delta_points: number;
  streak_delta: number;
  at: string;
}

export default function Gamification() {
  const { userId, logout } = useAuth();
  const { getName, members, familyName, loading: membersLoading } = useMembers();
  const familyId = localStorage.getItem("nagz_family_id");
  const myRole = members.find((m) => m.user_id === userId)?.role;

  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [events, setEvents] = useState<GamificationEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [noConsent, setNoConsent] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!familyId || !userId) return;
    setLoading(true);
    setError("");
    setNoConsent(false);

    const [summaryResult, lbResult, eventsResult] = await Promise.allSettled([
      customInstance<GamificationSummary>({
        url: "/api/v1/gamification/summary",
        method: "GET",
        params: { family_id: familyId },
      }),
      customInstance<LeaderboardResponse>({
        url: "/api/v1/gamification/leaderboard",
        method: "GET",
        params: { family_id: familyId },
      }),
      customInstance<GamificationEventItem[]>({
        url: "/api/v1/gamification/events",
        method: "GET",
        params: { user_id: userId, family_id: familyId },
      }),
    ]);

    if (summaryResult.status === "fulfilled") {
      setSummary(summaryResult.value);
    }
    if (lbResult.status === "fulfilled") {
      setLeaderboard(lbResult.value.leaderboard);
    }
    if (eventsResult.status === "fulfilled") {
      setEvents(eventsResult.value);
    }

    // Check if both failed with 403
    const summaryIs403 =
      summaryResult.status === "rejected" &&
      axios.isAxiosError(summaryResult.reason) &&
      summaryResult.reason.response?.status === 403;
    const lbIs403 =
      lbResult.status === "rejected" &&
      axios.isAxiosError(lbResult.reason) &&
      lbResult.reason.response?.status === 403;

    if (summaryIs403 || lbIs403) {
      setNoConsent(true);
    } else if (
      summaryResult.status === "rejected" &&
      lbResult.status === "rejected"
    ) {
      setError("Failed to load gamification data");
    }

    setLoading(false);
  }, [familyId, userId]);

  useEffect(() => {
    if (!familyId || !userId) {
      setLoading(false);
      return;
    }
    load();
  }, [familyId, userId, load]);

  const enableGamification = async () => {
    if (!familyId) return;
    setEnabling(true);
    try {
      await customInstance({
        url: "/api/v1/consents",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { consent_type: "gamification_participation", family_id: familyId },
      });
      setNoConsent(false);
      await load();
    } catch {
      setError("Failed to enable gamification.");
    }
    setEnabling(false);
  };

  if (!familyId) {
    return (
      <p>
        No family selected. <Link to="/">Go to dashboard</Link>
      </p>
    );
  }

  if (loading || membersLoading) return <p>Loading...</p>;

  if (noConsent) {
    return (
      <div>
        <div className="header">
          <h2>Leaderboard</h2>
          <div className="header-actions">
            <Link to="/">Family</Link>
            <span className="logged-in-as">{getName(userId!)}</span>
            <button onClick={logout} className="link-button">Logout</button>
          </div>
        </div>
        <p className="page-hint">
          Gamification is not enabled for this family. A guardian needs to grant
          the <strong>gamification_participation</strong> consent to enable
          points and leaderboards.
        </p>
        {myRole === "guardian" && (
          <button onClick={enableGamification} disabled={enabling}>
            {enabling ? "Enabling..." : "Enable Gamification"}
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  const formatEventType = (t: string) => {
    if (t === "nag_completed") return "Completed a nag";
    if (t === "nag_missed") return "Missed a nag";
    return t;
  };

  const recentEvents = [...events]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);

  return (
    <div>
      <div className="header">
        <h2>Leaderboard</h2>
        <div className="header-actions">
          {myRole === "guardian" ? (
            <Link to="/">Family</Link>
          ) : (
            <Link to="/kid">My Nags</Link>
          )}
          <span className="logged-in-as">{getName(userId!)}</span>
          <button onClick={logout} className="link-button">Logout</button>
        </div>
      </div>

      {familyName && (
        <p className="page-hint">{familyName} — Points & Streaks</p>
      )}

      {error && <p className="error">{error}</p>}

      {summary && (
        <div className="stats-bar">
          <div className="stat-card">
            <span className="stat-value">{summary.total_points}</span>
            <span className="stat-label">Your Points</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.current_streak}</span>
            <span className="stat-label">Day Streak</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.event_count}</span>
            <span className="stat-label">Events</span>
          </div>
        </div>
      )}

      {leaderboard.length === 0 ? (
        <p>No leaderboard data yet. Complete some nags to earn points!</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, i) => (
              <tr
                key={entry.user_id}
                className={entry.user_id === userId ? "row-highlight" : ""}
              >
                <td>
                  <span className="rank-number">{i + 1}</span>
                </td>
                <td>
                  {getName(entry.user_id)}
                  {entry.user_id === userId && (
                    <span className="you-badge">YOU</span>
                  )}
                </td>
                <td>{entry.total_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {recentEvents.length > 0 && (
        <div className="activity-feed">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            {recentEvents.map((ev) => (
              <div key={ev.id} className="activity-item">
                <span className="activity-type">{formatEventType(ev.event_type)}</span>
                <span className="activity-points">+{ev.delta_points} pts</span>
                <span className="activity-time">
                  {new Date(ev.at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

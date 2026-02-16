import { useEffect, useState } from "react";
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

export default function Gamification() {
  const { userId, logout } = useAuth();
  const { getName, members, familyName, loading: membersLoading } = useMembers();
  const familyId = localStorage.getItem("nagz_family_id");
  const myRole = members.find((m) => m.user_id === userId)?.role;

  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [noConsent, setNoConsent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!familyId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      // Fetch independently so one failure doesn't block the other
      const [summaryResult, lbResult] = await Promise.allSettled([
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
      ]);

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      }
      if (lbResult.status === "fulfilled") {
        setLeaderboard(lbResult.value.leaderboard);
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
    };
    load();
  }, [familyId]);

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
      </div>
    );
  }

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
    </div>
  );
}

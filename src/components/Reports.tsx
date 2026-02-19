import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance } from "../api/axios-instance";

interface WeeklyReport {
  family_id: string;
  period_start: string;
  metrics: { total_nags: number; completed: number; missed: number };
}

interface FamilyMetrics {
  family_id: string;
  from_date: string | null;
  to_date: string | null;
  total_nags: number;
  completed: number;
  missed: number;
  completion_rate: number;
}

interface DigestResponse {
  family_id: string;
  period_start: string;
  period_end: string;
  summary_text: string;
  member_summaries: { user_id: string; display_name: string | null; total_nags: number; completed: number; missed: number; completion_rate: number }[];
  totals: { total_nags: number; completed: number; missed: number; open: number; completion_rate: number };
}

interface PatternsResponse {
  user_id: string;
  family_id: string;
  insights: { day_of_week: string; miss_count: number }[];
  analyzed_at: string;
}

export default function Reports() {
  const { userId, logout } = useAuth();
  const { getName } = useMembers();
  const familyId = localStorage.getItem("nagz_family_id");
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [metrics, setMetrics] = useState<FamilyMetrics | null>(null);
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [patterns, setPatterns] = useState<PatternsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!familyId) return;
    (async () => {
      const [w, m, d, p] = await Promise.allSettled([
        customInstance<WeeklyReport>({
          url: "/api/v1/reports/family/weekly",
          method: "GET",
          params: { family_id: familyId },
        }),
        customInstance<FamilyMetrics>({
          url: "/api/v1/reports/family/metrics",
          method: "GET",
          params: { family_id: familyId },
        }),
        customInstance<DigestResponse>({
          url: "/api/v1/ai/digest",
          method: "GET",
          params: { family_id: familyId },
        }),
        customInstance<PatternsResponse>({
          url: "/api/v1/ai/patterns",
          method: "GET",
          params: { user_id: userId, family_id: familyId },
        }),
      ]);
      if (w.status === "fulfilled") setWeekly(w.value);
      if (m.status === "fulfilled") setMetrics(m.value);
      if (d.status === "fulfilled") setDigest(d.value);
      if (p.status === "fulfilled") setPatterns(p.value);
      if (w.status === "rejected" && m.status === "rejected") {
        setError("Failed to load reports");
      }
      setLoading(false);
    })();
  }, [familyId]);

  if (!familyId) return <p>No family selected. <Link to="/">Go to dashboard</Link></p>;
  if (loading) return <p>Loading reports...</p>;

  return (
    <div>
      <div className="header">
        <h2>Reports</h2>
        <div className="header-actions">
          <Link to="/">Family</Link>
          <span className="logged-in-as">{getName(userId ?? "")}</span>
          <button onClick={logout} className="link-button">Logout</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {metrics && (
        <div>
          <h3>Overall Metrics</h3>
          <table>
            <tbody>
              <tr><td>Total Nags</td><td><strong>{metrics.total_nags}</strong></td></tr>
              <tr><td>Completed</td><td><strong style={{ color: "#22c55e" }}>{metrics.completed}</strong></td></tr>
              <tr><td>Missed</td><td><strong style={{ color: "#ef4444" }}>{metrics.missed}</strong></td></tr>
              <tr>
                <td>Completion Rate</td>
                <td>
                  <strong style={{ color: metrics.completion_rate >= 0.7 ? "#22c55e" : "#ef4444" }}>
                    {Math.round(metrics.completion_rate * 100)}%
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {weekly && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Weekly Report</h3>
          <p className="page-hint">
            Week starting {new Date(weekly.period_start).toLocaleDateString()}
          </p>
          <table>
            <tbody>
              <tr><td>Total</td><td><strong>{weekly.metrics.total_nags}</strong></td></tr>
              <tr><td>Completed</td><td><strong style={{ color: "#22c55e" }}>{weekly.metrics.completed}</strong></td></tr>
              <tr><td>Missed</td><td><strong style={{ color: "#ef4444" }}>{weekly.metrics.missed}</strong></td></tr>
            </tbody>
          </table>
        </div>
      )}

      {digest && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>AI Digest</h3>
          <p className="page-hint">
            {new Date(digest.period_start).toLocaleDateString()} — {new Date(digest.period_end).toLocaleDateString()}
          </p>
          <p>{digest.summary_text}</p>
          {digest.member_summaries.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Total</th>
                  <th>Done</th>
                  <th>Missed</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {digest.member_summaries.map((ms) => (
                  <tr key={ms.user_id}>
                    <td>{ms.display_name ?? getName(ms.user_id)}</td>
                    <td>{ms.total_nags}</td>
                    <td style={{ color: "#22c55e" }}>{ms.completed}</td>
                    <td style={{ color: "#ef4444" }}>{ms.missed}</td>
                    <td>{Math.round(ms.completion_rate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {patterns && patterns.insights.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Behavioral Patterns</h3>
          <p className="page-hint">Days where nags are most frequently missed</p>
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Misses</th>
              </tr>
            </thead>
            <tbody>
              {patterns.insights
                .sort((a, b) => b.miss_count - a.miss_count)
                .map((ins) => (
                  <tr key={ins.day_of_week}>
                    <td>{ins.day_of_week}</td>
                    <td style={{ color: ins.miss_count > 0 ? "#ef4444" : undefined }}>
                      {ins.miss_count}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!metrics && !weekly && !error && <p>No report data available yet.</p>}
    </div>
  );
}

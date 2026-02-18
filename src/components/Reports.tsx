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

export default function Reports() {
  const { userId, logout } = useAuth();
  const { getName } = useMembers();
  const familyId = localStorage.getItem("nagz_family_id");
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [metrics, setMetrics] = useState<FamilyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!familyId) return;
    (async () => {
      const [w, m] = await Promise.allSettled([
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
      ]);
      if (w.status === "fulfilled") setWeekly(w.value);
      if (m.status === "fulfilled") setMetrics(m.value);
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

      {!metrics && !weekly && !error && <p>No report data available yet.</p>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance } from "../api/axios-instance";

interface Delivery {
  id: string;
  nag_event_id: string;
  channel: string;
  status: string;
  provider_ref: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#eab308",
  sent: "#3b82f6",
  delivered: "#22c55e",
  failed: "#ef4444",
};

export default function Deliveries() {
  const { userId, logout } = useAuth();
  const { getName } = useMembers();
  const [searchParams] = useSearchParams();
  const nagId = searchParams.get("nag_id");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!nagId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await customInstance<{ items: Delivery[] }>({
          url: "/api/v1/deliveries",
          method: "GET",
          params: { nag_id: nagId },
        });
        if (!cancelled) setDeliveries(data.items);
      } catch {
        if (!cancelled) setError("Failed to load deliveries");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [nagId]);

  if (!nagId) return <p>No nag specified. <Link to="/nags">Go to nagz</Link></p>;
  if (loading) return <p>Loading deliveries...</p>;

  return (
    <div>
      <div className="header">
        <h2>Delivery History</h2>
        <div className="header-actions">
          <Link to="/nags">Nagz</Link>
          <Link to="/">Family</Link>
          <span className="logged-in-as">{getName(userId ?? "")}</span>
          <button onClick={logout} className="link-button">Logout</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {deliveries.length === 0 ? (
        <p>No deliveries recorded for this nag.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th>Status</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td>{d.channel.toUpperCase()}</td>
                <td>
                  <span
                    className="badge"
                    style={{ backgroundColor: STATUS_COLORS[d.status] ?? "#6b7280" }}
                  >
                    {d.status}
                  </span>
                </td>
                <td style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  {d.provider_ref ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

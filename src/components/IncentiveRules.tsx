import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useMembers } from "../members";
import { customInstance, extractErrorMessage } from "../api/axios-instance";

interface IncentiveRule {
  id: string;
  family_id: string;
  version: number;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  approval_mode: string;
  status: string;
}

export default function IncentiveRules() {
  const { userId, logout } = useAuth();
  const { getName } = useMembers();
  const familyId = localStorage.getItem("nagz_family_id");

  const [rules, setRules] = useState<IncentiveRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [conditionType, setConditionType] = useState("nag_completed");
  const [conditionCount, setConditionCount] = useState(5);
  const [actionType, setActionType] = useState("bonus_points");
  const [actionAmount, setActionAmount] = useState(50);
  const [approvalMode, setApprovalMode] = useState("auto");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!familyId) return;
    setError("");
    try {
      const resp = await customInstance<{ items: IncentiveRule[]; total: number }>({
        url: "/api/v1/incentive-rules",
        method: "GET",
        params: { family_id: familyId },
      });
      setRules(resp.items ?? []);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to load incentive rules"));
    }
    setLoading(false);
  }, [familyId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!familyId) return;
    setCreating(true);
    setError("");
    try {
      await customInstance({
        url: "/api/v1/incentive-rules",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: {
          family_id: familyId,
          condition: { type: conditionType, count: conditionCount },
          action: { type: actionType, amount: actionAmount },
          approval_mode: approvalMode,
        },
      });
      setShowCreate(false);
      setConditionCount(5);
      setActionAmount(50);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to create rule"));
    }
    setCreating(false);
  };

  const conditionLabel = (c: Record<string, unknown>) => {
    const type = (c.type as string) ?? "event";
    const count = (c.count as number) ?? 0;
    return `Complete ${count} ${type.replace(/_/g, " ")}s`;
  };

  const actionLabel = (a: Record<string, unknown>) => {
    const type = (a.type as string) ?? "reward";
    const amount = (a.amount as number) ?? 0;
    return `${type.replace(/_/g, " ")}: ${amount}`;
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
        <h2>Incentive Rules</h2>
        <div className="header-actions">
          <Link to="/">Family</Link>
          <span className="logged-in-as">{getName(userId ?? "")}</span>
          <button onClick={logout} className="link-button">
            Logout
          </button>
        </div>
      </div>

      <p className="page-hint">
        Create reward rules to incentivize family members for completing nags.
      </p>

      {error && <p className="error">{error}</p>}

      {rules.length === 0 && !showCreate ? (
        <p>No incentive rules yet. Create one to get started.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Condition</th>
              <th>Reward</th>
              <th>Approval</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{conditionLabel(rule.condition)}</td>
                <td>{actionLabel(rule.action)}</td>
                <td>{rule.approval_mode.replace(/_/g, " ")}</td>
                <td>
                  <span
                    className={`badge badge-${rule.status === "active" ? "completed" : "missed"}`}
                  >
                    {rule.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        className="link-button"
        onClick={() => setShowCreate(!showCreate)}
        style={{ marginTop: "1rem" }}
      >
        {showCreate ? "Cancel" : "+ New Rule"}
      </button>

      {showCreate && (
        <form onSubmit={handleCreate} className="form" style={{ marginTop: "1rem" }}>
          <h3>New Incentive Rule</h3>
          <label>
            Condition Type
            <select
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value)}
            >
              <option value="nag_completed">Nag Completed</option>
              <option value="streak_reached">Streak Reached</option>
            </select>
          </label>
          <label>
            Count
            <input
              type="number"
              min={1}
              max={100}
              value={conditionCount}
              onChange={(e) => setConditionCount(Number(e.target.value))}
            />
          </label>
          <label>
            Reward Type
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
            >
              <option value="bonus_points">Bonus Points</option>
              <option value="badge">Badge</option>
            </select>
          </label>
          <label>
            Amount
            <input
              type="number"
              min={1}
              max={1000}
              value={actionAmount}
              onChange={(e) => setActionAmount(Number(e.target.value))}
            />
          </label>
          <label>
            Approval Mode
            <select
              value={approvalMode}
              onChange={(e) => setApprovalMode(e.target.value)}
            >
              <option value="auto">Automatic</option>
              <option value="guardian_confirmed">Guardian Confirmed</option>
            </select>
          </label>
          <button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create Rule"}
          </button>
        </form>
      )}
    </div>
  );
}

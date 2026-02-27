import { useEffect, useState } from "react";
import { customInstance, extractErrorMessage } from "../api/axios-instance";
import type { ChildSettingsResponse } from "../api/model";

interface ChildSettingsProps {
  familyId: string;
  childUserId: string;
  childName: string;
  onClose: () => void;
}

export function ChildSettings({
  familyId,
  childUserId,
  childName,
  onClose,
}: ChildSettingsProps) {
  const [canSnooze, setCanSnooze] = useState(true);
  const [maxSnoozesPerDay, setMaxSnoozesPerDay] = useState(3);
  const [canSubmitExcuses, setCanSubmitExcuses] = useState(true);
  const [quietHoursStart, setQuietHoursStart] = useState("");
  const [quietHoursEnd, setQuietHoursEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await customInstance<ChildSettingsResponse>({
          url: `/api/v1/families/${familyId}/children/${childUserId}/settings`,
          method: "GET",
        });
        setCanSnooze(data.can_snooze);
        setMaxSnoozesPerDay(data.max_snoozes_per_day);
        setCanSubmitExcuses(data.can_submit_excuses);
        setQuietHoursStart(data.quiet_hours_start ?? "");
        setQuietHoursEnd(data.quiet_hours_end ?? "");
      } catch {
        setError("Failed to load child settings.");
      }
      setLoading(false);
    })();
  }, [familyId, childUserId]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await customInstance({
        url: `/api/v1/families/${familyId}/children/${childUserId}/settings`,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: {
          can_snooze: canSnooze,
          max_snoozes_per_day: maxSnoozesPerDay,
          can_submit_excuses: canSubmitExcuses,
          quiet_hours_start: quietHoursStart || null,
          quiet_hours_end: quietHoursEnd || null,
        },
      });
      setSuccess(true);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to save settings."));
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Controls for {childName}</h3>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="form">
            <div className="toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={canSnooze}
                  onChange={(e) => setCanSnooze(e.target.checked)}
                />
                Can snooze nags
              </label>
            </div>

            {canSnooze && (
              <label>
                Max snoozes per day
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={maxSnoozesPerDay}
                  onChange={(e) => setMaxSnoozesPerDay(Number(e.target.value))}
                />
              </label>
            )}

            <div className="toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={canSubmitExcuses}
                  onChange={(e) => setCanSubmitExcuses(e.target.checked)}
                />
                Can submit excuses
              </label>
            </div>

            <label>
              Quiet hours start
              <input
                type="time"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
              />
            </label>

            <label>
              Quiet hours end
              <input
                type="time"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
              />
            </label>

            {error && <p className="error">{error}</p>}
            {success && (
              <p style={{ color: "var(--color-success)", fontSize: "0.875rem", margin: 0 }}>
                Settings saved.
              </p>
            )}

            <div className="card-actions">
              <button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

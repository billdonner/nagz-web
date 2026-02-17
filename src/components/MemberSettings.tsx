import { useEffect, useState } from "react";
import { customInstance, extractErrorMessage } from "../api/axios-instance";

interface PreferenceData {
  prefs_json: {
    gamification_enabled?: boolean;
    quiet_hours_enabled?: boolean;
    quiet_hours_start?: string;
    quiet_hours_end?: string;
    notification_frequency?: string;
    delivery_channel?: string;
    background_color?: string;
    tone?: string;
  };
}

interface MemberSettingsProps {
  userId: string;
  familyId: string;
  displayName: string;
  onClose: () => void;
  onSaved: () => void;
}

const COLOR_PRESETS = [
  "#f9fafb",
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#fce7f3",
  "#f3e8ff",
];

const TONE_OPTIONS = ["friendly", "firm", "playful", "empathetic"];

export function MemberSettings({
  userId,
  familyId,
  displayName,
  onClose,
  onSaved,
}: MemberSettingsProps) {
  const [gamificationEnabled, setGamificationEnabled] = useState(false);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("07:00");
  const [notificationFrequency, setNotificationFrequency] = useState("always");
  const [deliveryChannel, setDeliveryChannel] = useState("push");
  const [backgroundColor, setBackgroundColor] = useState("#f9fafb");
  const [tone, setTone] = useState("friendly");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await customInstance<PreferenceData>({
          url: `/api/v1/preferences/${userId}`,
          method: "GET",
          params: { family_id: familyId },
        });
        const p = data.prefs_json;
        setGamificationEnabled(p.gamification_enabled ?? false);
        setQuietHoursEnabled(p.quiet_hours_enabled ?? false);
        setQuietHoursStart(p.quiet_hours_start ?? "22:00");
        setQuietHoursEnd(p.quiet_hours_end ?? "07:00");
        setNotificationFrequency(p.notification_frequency ?? "always");
        setDeliveryChannel(p.delivery_channel ?? "push");
        setBackgroundColor(p.background_color ?? "#f9fafb");
        setTone(p.tone ?? "friendly");
      } catch {
        setError("Failed to load preferences.");
      }
      setLoading(false);
    })();
  }, [userId, familyId]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await customInstance({
        url: `/api/v1/preferences/${userId}`,
        method: "PATCH",
        params: { family_id: familyId },
        headers: { "Content-Type": "application/json" },
        data: {
          prefs_json: {
            gamification_enabled: gamificationEnabled,
            quiet_hours_enabled: quietHoursEnabled,
            quiet_hours_start: quietHoursStart,
            quiet_hours_end: quietHoursEnd,
            notification_frequency: notificationFrequency,
            delivery_channel: deliveryChannel,
            background_color: backgroundColor,
            tone,
          },
        },
      });
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to save preferences."));
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Settings for {displayName}</h3>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="form">
            <div className="toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={gamificationEnabled}
                  onChange={(e) => setGamificationEnabled(e.target.checked)}
                />
                Gamification enabled
              </label>
            </div>

            <div className="toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={quietHoursEnabled}
                  onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                />
                Quiet hours
              </label>
            </div>

            {quietHoursEnabled && (
              <div style={{ display: "flex", gap: "1rem" }}>
                <label style={{ flex: 1 }}>
                  Start
                  <input
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                  />
                </label>
                <label style={{ flex: 1 }}>
                  End
                  <input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                  />
                </label>
              </div>
            )}

            <label>
              Notification Frequency
              <select
                value={notificationFrequency}
                onChange={(e) => setNotificationFrequency(e.target.value)}
              >
                <option value="always">Always</option>
                <option value="once_per_phase">Once per phase</option>
                <option value="daily_digest">Daily digest</option>
              </select>
            </label>

            <label>
              Delivery Channel
              <select
                value={deliveryChannel}
                onChange={(e) => setDeliveryChannel(e.target.value)}
              >
                <option value="push">Push</option>
                <option value="sms">SMS</option>
                <option value="both">Both</option>
              </select>
            </label>

            <label>
              Background Color
              <div className="color-picker">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch${backgroundColor === color ? " selected" : ""}`}
                    style={{ background: color }}
                    onClick={() => setBackgroundColor(color)}
                    aria-label={color}
                  />
                ))}
              </div>
            </label>

            <label>
              Tone
              <select value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            {error && <p className="error">{error}</p>}

            <div className="card-actions">
              <button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

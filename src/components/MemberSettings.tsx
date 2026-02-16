import { useEffect, useState } from "react";
import { customInstance } from "../api/axios-instance";
import axios from "axios";

interface PreferenceData {
  prefs_json: {
    gamification_enabled?: boolean;
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
            background_color: backgroundColor,
            tone,
          },
        },
      });
      onSaved();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg =
          err.response?.data?.detail ?? err.response?.data?.error?.message;
        setError(msg ?? "Failed to save preferences.");
      } else {
        setError("Failed to save preferences.");
      }
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

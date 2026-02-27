/** Number of characters to show when truncating a UUID for display. */
export const UUID_DISPLAY_LENGTH = 8;

/** Dev token prefix used in dev auth mode. */
export const DEV_TOKEN_PREFIX = "dev:";

export const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  completed: "#22c55e",
  missed: "#ef4444",
  cancelled_relationship_change: "#6b7280",
};

export const CATEGORIES = ["chores", "meds", "homework", "appointments", "other"];

export const DONE_DEFS = [
  { value: "ack_only", label: "Acknowledge" },
  { value: "binary_check", label: "Check Off" },
  { value: "binary_with_note", label: "Check Off + Note" },
];

export function formatPhase(p: string): string {
  const map: Record<string, string> = {
    phase_0_initial: "Created",
    phase_1_due_soon: "Due Soon",
    phase_2_overdue_soft: "Overdue",
    phase_3_overdue_bounded_pushback: "Escalated",
    phase_4_guardian_review: "Guardian Review",
  };
  return map[p] ?? p;
}

export function statusLabel(s: string): string {
  return s.startsWith("cancelled") ? "cancelled" : s;
}

/** Urgency tier for open nags based on time until/since due date. */
export type UrgencyTier = "calm" | "approaching" | "dueSoon" | "overdue" | "critical";

/** Compute urgency tier for a nag based on due_at and status. */
export function urgencyTier(dueAt: string, status: string): UrgencyTier {
  if (status !== "open") return "calm";
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const hoursUntil = (due - now) / (1000 * 60 * 60);
  if (hoursUntil > 24) return "calm";
  if (hoursUntil > 2) return "approaching";
  if (hoursUntil > 0) return "dueSoon";
  if (hoursUntil > -1) return "overdue";
  return "critical";
}

/** Due-date text color for each urgency tier. */
export const URGENCY_COLORS: Record<UrgencyTier, string> = {
  calm: "",            // inherit default
  approaching: "#3b82f6", // blue
  dueSoon: "#eab308",     // yellow
  overdue: "#f97316",     // orange
  critical: "#ef4444",    // red
};

/** Left accent border color for each urgency tier (empty = no border). */
export const URGENCY_BORDER: Record<UrgencyTier, string> = {
  calm: "",
  approaching: "",
  dueSoon: "#eab308",
  overdue: "#f97316",
  critical: "#ef4444",
};

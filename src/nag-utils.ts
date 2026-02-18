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

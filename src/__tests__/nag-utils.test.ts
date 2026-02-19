import { describe, it, expect } from "vitest";
import {
  UUID_DISPLAY_LENGTH,
  DEV_TOKEN_PREFIX,
  STATUS_COLORS,
  CATEGORIES,
  DONE_DEFS,
  formatPhase,
  statusLabel,
} from "../nag-utils";

describe("nag-utils constants", () => {
  it("UUID_DISPLAY_LENGTH is 8", () => {
    expect(UUID_DISPLAY_LENGTH).toBe(8);
  });

  it("DEV_TOKEN_PREFIX is 'dev:'", () => {
    expect(DEV_TOKEN_PREFIX).toBe("dev:");
  });

  it("STATUS_COLORS has all expected statuses", () => {
    expect(STATUS_COLORS).toHaveProperty("open");
    expect(STATUS_COLORS).toHaveProperty("completed");
    expect(STATUS_COLORS).toHaveProperty("missed");
    expect(STATUS_COLORS).toHaveProperty("cancelled_relationship_change");
    expect(Object.keys(STATUS_COLORS)).toHaveLength(4);
  });

  it("STATUS_COLORS values are valid hex colors", () => {
    for (const color of Object.values(STATUS_COLORS)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("CATEGORIES has all expected values", () => {
    expect(CATEGORIES).toEqual(["chores", "meds", "homework", "appointments", "other"]);
  });

  it("DONE_DEFS has all expected definitions", () => {
    expect(DONE_DEFS).toHaveLength(3);
    const values = DONE_DEFS.map((d) => d.value);
    expect(values).toContain("ack_only");
    expect(values).toContain("binary_check");
    expect(values).toContain("binary_with_note");
  });

  it("DONE_DEFS entries have value and label", () => {
    for (const def of DONE_DEFS) {
      expect(def).toHaveProperty("value");
      expect(def).toHaveProperty("label");
      expect(def.label.length).toBeGreaterThan(0);
    }
  });
});

describe("formatPhase", () => {
  it("maps phase_0_initial to Created", () => {
    expect(formatPhase("phase_0_initial")).toBe("Created");
  });

  it("maps phase_1_due_soon to Due Soon", () => {
    expect(formatPhase("phase_1_due_soon")).toBe("Due Soon");
  });

  it("maps phase_2_overdue_soft to Overdue", () => {
    expect(formatPhase("phase_2_overdue_soft")).toBe("Overdue");
  });

  it("maps phase_3_overdue_bounded_pushback to Escalated", () => {
    expect(formatPhase("phase_3_overdue_bounded_pushback")).toBe("Escalated");
  });

  it("maps phase_4_guardian_review to Guardian Review", () => {
    expect(formatPhase("phase_4_guardian_review")).toBe("Guardian Review");
  });

  it("returns unknown phase strings as-is", () => {
    expect(formatPhase("phase_99_unknown")).toBe("phase_99_unknown");
  });

  it("returns empty string as-is", () => {
    expect(formatPhase("")).toBe("");
  });
});

describe("statusLabel", () => {
  it("returns open as-is", () => {
    expect(statusLabel("open")).toBe("open");
  });

  it("returns completed as-is", () => {
    expect(statusLabel("completed")).toBe("completed");
  });

  it("returns missed as-is", () => {
    expect(statusLabel("missed")).toBe("missed");
  });

  it("normalizes cancelled_relationship_change to cancelled", () => {
    expect(statusLabel("cancelled_relationship_change")).toBe("cancelled");
  });

  it("normalizes cancelled_any_suffix to cancelled", () => {
    expect(statusLabel("cancelled_foo")).toBe("cancelled");
  });

  it("returns non-cancelled statuses as-is", () => {
    expect(statusLabel("pending")).toBe("pending");
  });
});

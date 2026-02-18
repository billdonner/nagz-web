import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth";
import { MembersProvider, type Member } from "../members";

// ---------------------------------------------------------------------------
// Shared helpers (same pattern as phase3)
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  length: 0,
  key: vi.fn(() => null),
};
vi.stubGlobal("localStorage", localStorageMock);

// Auth token now uses sessionStorage
const sessionStore: Record<string, string> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => sessionStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { sessionStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete sessionStore[key]; }),
  clear: vi.fn(() => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); }),
  length: 0,
  key: vi.fn(() => null),
};
vi.stubGlobal("sessionStorage", sessionStorageMock);

vi.mock("../api/axios-instance", () => ({
  customInstance: vi.fn(),
  extractErrorMessage: (_err: unknown, fallback = "Something went wrong.") => fallback,
  AXIOS_INSTANCE: { get: vi.fn().mockResolvedValue({ data: {} }) },
}));

vi.mock("../version", () => ({
  CLIENT_API_VERSION: "1.0.0",
  VersionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useVersion: () => ({ status: { kind: "compatible" }, serverInfo: null, dismissWarning: () => {} }),
}));

import { customInstance } from "../api/axios-instance";

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  Object.keys(sessionStore).forEach(k => delete sessionStore[k]);
  vi.clearAllMocks();
});

function Providers({
  children,
  initialEntries = ["/"],
}: {
  children: React.ReactNode;
  initialEntries?: string[];
}) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <MembersProvider>{children}</MembersProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

// ===================================================
// 1. Gamification Component
// ===================================================

import Gamification from "../components/Gamification";

describe("Gamification", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
  });

  it("shows 'No family selected' when no family_id", () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <Gamification />
      </Providers>
    );
    expect(screen.getByText("No family selected.")).toBeDefined();
  });

  it("shows loading state initially", () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation(() => new Promise(() => {}));
    render(
      <Providers>
        <Gamification />
      </Providers>
    );
    expect(screen.getByText("Loading...")).toBeDefined();
  });

  it("renders leaderboard with data", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/summary")) {
        return Promise.resolve({ family_id: "fam-1", user_id: "user-1", total_points: 150, current_streak: 3, event_count: 10 });
      }
      if (config.url.includes("/leaderboard")) {
        return Promise.resolve({ family_id: "fam-1", period_start: "2026-02-01", leaderboard: [
          { user_id: "user-1", total_points: 150 },
          { user_id: "user-2", total_points: 100 },
        ]});
      }
      if (config.url.includes("/events")) {
        return Promise.resolve({ items: [], total: 0 });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <Gamification />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Your Points")).toBeDefined();
    });
    expect(screen.getAllByText("150").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Day Streak")).toBeDefined();
    expect(screen.getByText("Rank")).toBeDefined();
  });

  it("shows 'No leaderboard data' message when empty", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/summary")) {
        return Promise.resolve({ family_id: "fam-1", user_id: "user-1", total_points: 0, current_streak: 0, event_count: 0 });
      }
      if (config.url.includes("/leaderboard")) {
        return Promise.resolve({ family_id: "fam-1", period_start: "2026-02-01", leaderboard: [] });
      }
      if (config.url.includes("/events")) return Promise.resolve({ items: [], total: 0 });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <Gamification />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText(/No leaderboard data yet/)).toBeDefined();
    });
  });

  it("renders recent activity events", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/summary")) {
        return Promise.resolve({ family_id: "fam-1", user_id: "user-1", total_points: 50, current_streak: 1, event_count: 1 });
      }
      if (config.url.includes("/leaderboard")) {
        return Promise.resolve({ family_id: "fam-1", period_start: "2026-02-01", leaderboard: [] });
      }
      if (config.url.includes("/events")) {
        return Promise.resolve({ items: [
          { id: "ev-1", family_id: "fam-1", user_id: "user-1", event_type: "nag_completed", delta_points: 10, streak_delta: 1, at: "2026-02-18T10:00:00Z" },
        ], total: 1 });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <Gamification />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeDefined();
    });
    expect(screen.getByText("Completed a nag")).toBeDefined();
    expect(screen.getByText("+10 pts")).toBeDefined();
  });
});

// ===================================================
// 2. Consents Component
// ===================================================

import Consents from "../components/Consents";

describe("Consents", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
  });

  it("shows 'No family selected' when no family_id", () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <Consents />
      </Providers>
    );
    expect(screen.getByText("No family selected.")).toBeDefined();
  });

  it("renders all 4 consent types with Grant buttons", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/consents")) return Promise.resolve({ items: [], total: 0 });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <Consents />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Gamification")).toBeDefined();
    });
    expect(screen.getByText("AI Mediation")).toBeDefined();
    expect(screen.getByText("SMS Notifications")).toBeDefined();
    expect(screen.getByText("Child Account Creation")).toBeDefined();
    const grantButtons = screen.getAllByText("Grant");
    expect(grantButtons.length).toBe(4);
  });

  it("shows Revoke button for granted consents", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/consents")) {
        return Promise.resolve({ items: [
          { id: "c1", user_id: "user-1", family_id_nullable: "fam-1", consent_type: "gamification_participation" },
        ], total: 1 });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <Consents />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Revoke")).toBeDefined();
    });
    // 3 remaining should have "Grant"
    const grantButtons = screen.getAllByText("Grant");
    expect(grantButtons.length).toBe(3);
  });
});

// ===================================================
// 3. Safety Component
// ===================================================

import Safety from "../components/Safety";

describe("Safety", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
    store["nagz_family_id"] = "fam-1";
  });

  it("renders safety page title and sections", async () => {
    const members: Member[] = [
      { user_id: "user-1", display_name: "Alice", family_id: "fam-1", role: "guardian", status: "active", joined_at: "2026-01-01T00:00:00Z" },
      { user_id: "user-2", display_name: "Bob", family_id: "fam-1", role: "child", status: "active", joined_at: "2026-01-01T00:00:00Z" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: members, total: 2 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <Safety />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Safety & Account")).toBeDefined();
    });
    expect(screen.getByText("Report a Member")).toBeDefined();
    expect(screen.getByText("Block a Member")).toBeDefined();
    expect(screen.getByText("Delete Account")).toBeDefined();
  });

  it("shows report and block buttons for other members only", async () => {
    const members: Member[] = [
      { user_id: "user-1", display_name: "Alice", family_id: "fam-1", role: "guardian", status: "active", joined_at: "2026-01-01T00:00:00Z" },
      { user_id: "user-2", display_name: "Bob", family_id: "fam-1", role: "child", status: "active", joined_at: "2026-01-01T00:00:00Z" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: members, total: 2 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <Safety />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Report Bob")).toBeDefined();
    });
    expect(screen.getByText("Block Bob")).toBeDefined();
    // Should NOT show "Report Alice" (self)
    expect(screen.queryByText("Report Alice")).toBeNull();
    expect(screen.queryByText("Block Alice")).toBeNull();
  });

  it("shows Delete My Account button", async () => {
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <Safety />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Delete My Account")).toBeDefined();
    });
  });

  it("shows confirm/cancel buttons when Delete My Account is clicked", async () => {
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <Safety />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Delete My Account")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Delete My Account"));
    expect(screen.getByText("Confirm Delete")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });
});

// ===================================================
// 4. Policies Component
// ===================================================

import Policies from "../components/Policies";

describe("Policies", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
  });

  it("shows 'No family selected' without family_id", () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <Policies />
      </Providers>
    );
    expect(screen.getByText("No family selected.")).toBeDefined();
  });

  it("shows loading state", () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation(() => new Promise(() => {}));
    render(
      <Providers>
        <Policies />
      </Providers>
    );
    expect(screen.getByText("Loading policies...")).toBeDefined();
  });

  it("shows 'No policies found' when empty", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <Policies />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("No policies found.")).toBeDefined();
    });
  });

  it("renders policy table with data", async () => {
    store["nagz_family_id"] = "fam-1";
    const policies = [
      { id: "p1", strategy_template: "friendly_reminder", status: "active", owners: ["user-1"], family_id: "fam-1" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/policies")) return Promise.resolve({ items: policies, total: 1 });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <Policies />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Friendly Reminder")).toBeDefined();
    });
    expect(screen.getByText("active")).toBeDefined();
  });
});

// ===================================================
// 5. Reports Component
// ===================================================

import Reports from "../components/Reports";

describe("Reports", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
  });

  it("shows 'No family selected' without family_id", () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <Reports />
      </Providers>
    );
    expect(screen.getByText(/No family selected/)).toBeDefined();
  });

  it("shows loading state", () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation(() => new Promise(() => {}));
    render(
      <Providers>
        <Reports />
      </Providers>
    );
    expect(screen.getByText("Loading reports...")).toBeDefined();
  });

  it("renders metrics when available", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/metrics")) {
        return Promise.resolve({
          family_id: "fam-1", from_date: null, to_date: null,
          total_nags: 20, completed: 15, missed: 5, completion_rate: 0.75,
        });
      }
      return Promise.reject(new Error("not found"));
    });
    render(
      <Providers>
        <Reports />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Overall Metrics")).toBeDefined();
    });
    expect(screen.getByText("20")).toBeDefined();
    expect(screen.getByText("15")).toBeDefined();
    expect(screen.getByText("75%")).toBeDefined();
  });

  it("shows error when neither metrics nor weekly available", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.reject(new Error("not found"));
    });
    render(
      <Providers>
        <Reports />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Failed to load reports")).toBeDefined();
    });
  });
});

// ===================================================
// 6. Deliveries Component
// ===================================================

import Deliveries from "../components/Deliveries";

describe("Deliveries", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
  });

  it("shows 'No nag specified' without nag_id query param", () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <Deliveries />
      </Providers>
    );
    expect(screen.getByText(/No nag specified/)).toBeDefined();
  });

  it("shows loading state with nag_id", () => {
    (customInstance as Mock).mockImplementation(() => new Promise(() => {}));
    render(
      <Providers initialEntries={["/?nag_id=nag-1"]}>
        <Deliveries />
      </Providers>
    );
    expect(screen.getByText("Loading deliveries...")).toBeDefined();
  });

  it("shows 'No deliveries recorded' when empty", async () => {
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/deliveries")) return Promise.resolve({ items: [] });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers initialEntries={["/?nag_id=nag-1"]}>
        <Deliveries />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("No deliveries recorded for this nag.")).toBeDefined();
    });
  });

  it("renders delivery table with data", async () => {
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/deliveries")) {
        return Promise.resolve({ items: [
          { id: "d1", nag_event_id: "e1", channel: "push", status: "delivered", provider_ref: "ref-123" },
          { id: "d2", nag_event_id: "e2", channel: "sms", status: "failed", provider_ref: null },
        ]});
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers initialEntries={["/?nag_id=nag-1"]}>
        <Deliveries />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("PUSH")).toBeDefined();
    });
    expect(screen.getByText("SMS")).toBeDefined();
    expect(screen.getByText("delivered")).toBeDefined();
    expect(screen.getByText("failed")).toBeDefined();
    expect(screen.getByText("ref-123")).toBeDefined();
  });
});

// ===================================================
// 7. IncentiveRules Component
// ===================================================

import IncentiveRules from "../components/IncentiveRules";

describe("IncentiveRules", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
  });

  it("shows 'No family selected' without family_id", () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <IncentiveRules />
      </Providers>
    );
    expect(screen.getByText("No family selected.")).toBeDefined();
  });

  it("shows 'No incentive rules yet' when empty", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/incentive-rules")) return Promise.resolve({ items: [], total: 0 });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <IncentiveRules />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText(/No incentive rules yet/)).toBeDefined();
    });
    expect(screen.getByText("+ New Rule")).toBeDefined();
  });

  it("shows create form when '+ New Rule' is clicked", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/incentive-rules")) return Promise.resolve({ items: [], total: 0 });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <IncentiveRules />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("+ New Rule")).toBeDefined();
    });
    fireEvent.click(screen.getByText("+ New Rule"));
    expect(screen.getByText("New Incentive Rule")).toBeDefined();
    expect(screen.getByText("Condition Type")).toBeDefined();
    expect(screen.getByText("Reward Type")).toBeDefined();
    expect(screen.getByText("Approval Mode")).toBeDefined();
  });

  it("renders rules table with data", async () => {
    store["nagz_family_id"] = "fam-1";
    const rules = [
      { id: "r1", family_id: "fam-1", version: 1, condition: { type: "nag_completed", count: 5 }, action: { type: "bonus_points", amount: 50 }, approval_mode: "auto", status: "active" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/incentive-rules")) return Promise.resolve({ items: rules, total: 1 });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <IncentiveRules />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Condition")).toBeDefined();
    });
    expect(screen.getByText("Reward")).toBeDefined();
    expect(screen.getByText("active")).toBeDefined();
  });
});

// ===================================================
// 8. MemberSettings Component
// ===================================================

import { MemberSettings } from "../components/MemberSettings";

describe("MemberSettings", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
    store["nagz_family_id"] = "fam-1";
  });

  it("shows loading state initially", () => {
    (customInstance as Mock).mockImplementation(() => new Promise(() => {}));
    render(
      <Providers>
        <MemberSettings
          userId="user-2"
          familyId="fam-1"
          displayName="Bob"
          onClose={() => {}}
          onSaved={() => {}}
        />
      </Providers>
    );
    expect(screen.getByText("Settings for Bob")).toBeDefined();
    expect(screen.getByText("Loading...")).toBeDefined();
  });

  it("renders all preference fields when loaded", async () => {
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/preferences/")) {
        return Promise.resolve({
          prefs_json: {
            gamification_enabled: true,
            quiet_hours_enabled: false,
            notification_frequency: "always",
            delivery_channel: "push",
            background_color: "#f9fafb",
            tone: "friendly",
          },
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <MemberSettings
          userId="user-2"
          familyId="fam-1"
          displayName="Bob"
          onClose={() => {}}
          onSaved={() => {}}
        />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Gamification enabled")).toBeDefined();
    });
    expect(screen.getByText("Quiet hours")).toBeDefined();
    expect(screen.getByText("Notification Frequency")).toBeDefined();
    expect(screen.getByText("Delivery Channel")).toBeDefined();
    expect(screen.getByText("Background Color")).toBeDefined();
    expect(screen.getByText("Tone")).toBeDefined();
    expect(screen.getByText("Save")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/preferences/")) {
        return Promise.resolve({ prefs_json: {} });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <MemberSettings
          userId="user-2"
          familyId="fam-1"
          displayName="Bob"
          onClose={onClose}
          onSaved={() => {}}
        />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows error message on load failure", async () => {
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/preferences/")) return Promise.reject(new Error("fail"));
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <MemberSettings
          userId="user-2"
          familyId="fam-1"
          displayName="Bob"
          onClose={() => {}}
          onSaved={() => {}}
        />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Failed to load preferences.")).toBeDefined();
    });
  });
});

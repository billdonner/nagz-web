import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "../auth";
import { MembersProvider, useMembers, type Member } from "../members";

// ---------------------------------------------------------------------------
// Shared helpers
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

// Mock customInstance from axios-instance
vi.mock("../api/axios-instance", () => ({
  customInstance: vi.fn(),
  extractErrorMessage: (_err: unknown, fallback = "Something went wrong.") => fallback,
  AXIOS_INSTANCE: { get: vi.fn().mockResolvedValue({ data: {} }) },
}));

// Mock version — prevent network calls
vi.mock("../version", () => ({
  CLIENT_API_VERSION: "1.0.0",
  VersionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useVersion: () => ({ status: { kind: "compatible" }, serverInfo: null, dismissWarning: () => {} }),
}));

import { customInstance } from "../api/axios-instance";

// Reset helpers between tests
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  Object.keys(sessionStore).forEach(k => delete sessionStore[k]);
  vi.clearAllMocks();
});

// Provide all required wrappers
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
// 1. ProtectedRoute / GuardianRoute / NagCreatorRoute
// ===================================================

// We import App routes indirectly by testing the real App component behavior.
// Since the route components are defined inline in App.tsx, we test via navigation.

import App from "../App";

// Re-mock BrowserRouter so App uses MemoryRouter
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

function renderApp(entries: string[]) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <App />
    </MemoryRouter>
  );
}

describe("Route Protection", () => {
  it("redirects unauthenticated user to /login", () => {
    renderApp(["/"]);
    expect(screen.getByText("Nagz")).toBeDefined();
    expect(screen.getByText("Family nagging system")).toBeDefined();
  });

  it("redirects unauthenticated user from /nags to /login", () => {
    renderApp(["/nags"]);
    expect(screen.getByText("Family nagging system")).toBeDefined();
  });

  it("redirects unauthenticated user from /family to /login", () => {
    renderApp(["/family"]);
    expect(screen.getByText("Family nagging system")).toBeDefined();
  });

  it("redirects unauthenticated user from /create-nag to /login", () => {
    renderApp(["/create-nag"]);
    expect(screen.getByText("Family nagging system")).toBeDefined();
  });

  it("shows login page at /login for unauthenticated user", () => {
    renderApp(["/login"]);
    expect(screen.getByText("Sign in as a family member:")).toBeDefined();
  });

  it("authenticated user on /login is redirected away", () => {
    sessionStore["nagz_token"] = "dev:user-1";
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    renderApp(["/login"]);
    // Should NOT see the login page
    expect(screen.queryByText("Sign in as a family member:")).toBeNull();
  });

  it("catches unknown routes and redirects to /", () => {
    renderApp(["/nonexistent-page"]);
    // Should redirect to / → login since not authenticated
    expect(screen.getByText("Family nagging system")).toBeDefined();
  });
});

// ===================================================
// 2. Login Component
// ===================================================

describe("Login Component", () => {
  it("renders all 5 dev user buttons", () => {
    renderApp(["/login"]);
    expect(screen.getByText("Andrew")).toBeDefined();
    expect(screen.getByText("Katherine")).toBeDefined();
    expect(screen.getByText("George")).toBeDefined();
    expect(screen.getByText("Teddy")).toBeDefined();
    expect(screen.getByText("Will")).toBeDefined();
  });

  it("shows role labels for dev users", () => {
    renderApp(["/login"]);
    const guardianLabels = screen.getAllByText("guardian");
    expect(guardianLabels.length).toBe(2); // Andrew + Katherine
    const childLabels = screen.getAllByText("child");
    expect(childLabels.length).toBe(3); // George, Teddy, Will
  });

  it("clicking a dev user sets token in sessionStorage", async () => {
    renderApp(["/login"]);
    act(() => {
      screen.getByText("Andrew").click();
    });
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      "nagz_token",
      "dev:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    );
  });

  it("clicking a dev user sets family_id in localStorage", async () => {
    renderApp(["/login"]);
    act(() => {
      screen.getByText("Andrew").click();
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "nagz_family_id",
      "93803dda-64e6-491c-b460-02ab3b72c465"
    );
  });
});

// ===================================================
// 3. MembersProvider
// ===================================================

function MembersConsumer() {
  const { members, familyName, inviteCode, getName, loading } = useMembers();
  return (
    <div>
      <span data-testid="loading">{loading ? "yes" : "no"}</span>
      <span data-testid="family-name">{familyName ?? "null"}</span>
      <span data-testid="invite-code">{inviteCode ?? "null"}</span>
      <span data-testid="member-count">{members.length}</span>
      <span data-testid="get-name">{getName("user-1")}</span>
    </div>
  );
}

describe("MembersProvider", () => {
  it("starts in loading state", () => {
    // No family_id in localStorage → loading stops immediately but members empty
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <MembersConsumer />
      </Providers>
    );
    // Without nagz_family_id, loading should stop immediately
    expect(screen.getByTestId("member-count").textContent).toBe("0");
  });

  it("loads members and family data when family_id is set", async () => {
    store["nagz_family_id"] = "fam-1";
    const members: Member[] = [
      { user_id: "user-1", display_name: "Alice", family_id: "fam-1", role: "guardian", status: "active", joined_at: "2026-01-01T00:00:00Z" },
      { user_id: "user-2", display_name: "Bob", family_id: "fam-1", role: "child", status: "active", joined_at: "2026-01-01T00:00:00Z" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) {
        return Promise.resolve({ items: members, total: 2 });
      }
      return Promise.resolve({ family_id: "fam-1", name: "Test Family", invite_code: "ABC123" });
    });
    render(
      <Providers>
        <MembersConsumer />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("no");
    });
    expect(screen.getByTestId("family-name").textContent).toBe("Test Family");
    expect(screen.getByTestId("invite-code").textContent).toBe("ABC123");
    expect(screen.getByTestId("member-count").textContent).toBe("2");
    expect(screen.getByTestId("get-name").textContent).toBe("Alice");
  });

  it("getName falls back to truncated id when member not found", async () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <MembersConsumer />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("no");
    });
    expect(screen.getByTestId("get-name").textContent).toBe("user-1...");
  });

  it("getName uses user_id prefix when display_name is null", async () => {
    store["nagz_family_id"] = "fam-1";
    const members: Member[] = [
      { user_id: "user-1", display_name: null, family_id: "fam-1", role: "child", status: "active", joined_at: "2026-01-01T00:00:00Z" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) {
        return Promise.resolve({ items: members, total: 1 });
      }
      return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
    });
    render(
      <Providers>
        <MembersConsumer />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("no");
    });
    // display_name is null → uses user_id.slice(0,8)
    expect(screen.getByTestId("get-name").textContent).toBe("user-1");
  });

  it("handles API failure gracefully", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockRejectedValue(new Error("Network error"));
    render(
      <Providers>
        <MembersConsumer />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("no");
    });
    // Should still render with empty members, no crash
    expect(screen.getByTestId("member-count").textContent).toBe("0");
  });
});

// ===================================================
// 4. NagList Component
// ===================================================

import NagList from "../components/NagList";

describe("NagList", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
  });

  it("shows 'No family selected' when no family_id in localStorage", () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <NagList />
      </Providers>
    );
    expect(screen.getByText("No family selected.")).toBeDefined();
    expect(screen.getByText("Go to dashboard")).toBeDefined();
  });

  it("shows loading state initially", () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation(() => new Promise(() => {})); // never resolves
    render(
      <Providers>
        <NagList />
      </Providers>
    );
    expect(screen.getByText("Loading nagz...")).toBeDefined();
  });

  it("shows 'No nagz found' when no nags returned", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <NagList />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("No nagz found.")).toBeDefined();
    });
  });

  it("renders nag table with data", async () => {
    store["nagz_family_id"] = "fam-1";
    const nags = [
      {
        id: "nag-1",
        family_id: "fam-1",
        creator_id: "user-1",
        recipient_id: "user-2",
        category: "chores",
        done_definition: "ack_only",
        status: "open",
        due_at: "2026-03-01T10:00:00Z",
        created_at: "2026-02-01T10:00:00Z",
        description: "Clean room",
        strategy_template: "default",
      },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: nags, total: 1 });
    });
    render(
      <Providers>
        <NagList />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("chores")).toBeDefined();
    });
    expect(screen.getByText("Clean room")).toBeDefined();
    expect(screen.getByText("open")).toBeDefined();
  });

  it("renders filter buttons (All, Open, Done, Missed)", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <NagList />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("All")).toBeDefined();
    });
    expect(screen.getByText("Open")).toBeDefined();
    expect(screen.getByText("Done")).toBeDefined();
    expect(screen.getByText("Missed")).toBeDefined();
  });

  it("renders sortable column headers", async () => {
    store["nagz_family_id"] = "fam-1";
    const nags = [
      {
        id: "nag-1", family_id: "fam-1", creator_id: "user-1", recipient_id: "user-2",
        category: "chores", done_definition: "ack_only", status: "open",
        due_at: "2026-03-01T10:00:00Z", created_at: "2026-02-01T10:00:00Z",
        strategy_template: "default",
      },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: nags, total: 1 });
    });
    render(
      <Providers>
        <NagList />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText(/^Nag/)).toBeDefined();
    });
    expect(screen.getByText(/^Status/)).toBeDefined();
    expect(screen.getByText(/^To/)).toBeDefined();
    expect(screen.getByText(/^From/)).toBeDefined();
    expect(screen.getByText(/^Due/)).toBeDefined();
  });

  it("has a '+ New Nag' button", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <NagList />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("+ New Nag")).toBeDefined();
    });
  });

  it("displays cancelled status as 'cancelled'", async () => {
    store["nagz_family_id"] = "fam-1";
    const nags = [
      {
        id: "nag-1", family_id: "fam-1", creator_id: "user-1", recipient_id: "user-2",
        category: "chores", done_definition: "ack_only", status: "cancelled_relationship_change",
        due_at: "2026-03-01T10:00:00Z", created_at: "2026-02-01T10:00:00Z",
        strategy_template: "default",
      },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: nags, total: 1 });
    });
    render(
      <Providers>
        <NagList />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("cancelled")).toBeDefined();
    });
  });
});

// ===================================================
// 5. FamilyDashboard Component
// ===================================================

import FamilyDashboard from "../components/FamilyDashboard";

describe("FamilyDashboard", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
  });

  it("shows family ID prompt when no family_id in localStorage", async () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <FamilyDashboard />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Enter your family ID to get started:")).toBeDefined();
    });
    expect(screen.getByPlaceholderText("family-uuid")).toBeDefined();
    expect(screen.getByText("Load Family")).toBeDefined();
  });

  it("shows family name and members when family_id is set", async () => {
    store["nagz_family_id"] = "fam-1";
    const members: Member[] = [
      { user_id: "user-1", display_name: "Alice", family_id: "fam-1", role: "guardian", status: "active", joined_at: "2026-01-01T00:00:00Z" },
      { user_id: "user-2", display_name: "Bob", family_id: "fam-1", role: "child", status: "active", joined_at: "2026-01-01T00:00:00Z" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: members, total: 2 });
      if (config.url.includes("/families/fam-1") && !config.url.includes("/members")) {
        return Promise.resolve({ family_id: "fam-1", name: "Test Family", invite_code: "INV123" });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <FamilyDashboard />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Test Family")).toBeDefined();
    });
    expect(screen.getByText("Members")).toBeDefined();
    expect(screen.getByText("Alice (guardian)")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
  });

  it("shows invite code when available", async () => {
    store["nagz_family_id"] = "fam-1";
    const members: Member[] = [
      { user_id: "user-1", display_name: "Alice", family_id: "fam-1", role: "guardian", status: "active", joined_at: "2026-01-01T00:00:00Z" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: members, total: 1 });
      if (config.url.includes("/families/fam-1") && !config.url.includes("/members")) {
        return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: "INV-CODE" });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <FamilyDashboard />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("INV-CODE")).toBeDefined();
    });
    expect(screen.getByText("Invite Code:")).toBeDefined();
    expect(screen.getByText("Copy")).toBeDefined();
  });

  it("guardian sees admin links (Reports, Consents, Incentives, Policies)", async () => {
    store["nagz_family_id"] = "fam-1";
    const members: Member[] = [
      { user_id: "user-1", display_name: "Alice", family_id: "fam-1", role: "guardian", status: "active", joined_at: "2026-01-01T00:00:00Z" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: members, total: 1 });
      if (config.url.includes("/families/fam-1") && !config.url.includes("/members")) {
        return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <FamilyDashboard />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Reports")).toBeDefined();
    });
    expect(screen.getByText("Consents")).toBeDefined();
    expect(screen.getByText("Incentives")).toBeDefined();
    expect(screen.getByText("Policies")).toBeDefined();
  });

  it("non-guardian does NOT see admin links", async () => {
    store["nagz_family_id"] = "fam-1";
    sessionStore["nagz_token"] = "dev:user-2";
    const members: Member[] = [
      { user_id: "user-2", display_name: "Bob", family_id: "fam-1", role: "child", status: "active", joined_at: "2026-01-01T00:00:00Z" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: members, total: 1 });
      if (config.url.includes("/families/fam-1") && !config.url.includes("/members")) {
        return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <FamilyDashboard />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("F")).toBeDefined();
    });
    expect(screen.queryByText("Reports")).toBeNull();
    expect(screen.queryByText("Consents")).toBeNull();
    expect(screen.queryByText("Incentives")).toBeNull();
    expect(screen.queryByText("Policies")).toBeNull();
  });

  it("guardian sees '+ Add family member' button", async () => {
    store["nagz_family_id"] = "fam-1";
    const members: Member[] = [
      { user_id: "user-1", display_name: "Alice", family_id: "fam-1", role: "guardian", status: "active", joined_at: "2026-01-01T00:00:00Z" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: members, total: 1 });
      if (config.url.includes("/families/fam-1") && !config.url.includes("/members")) {
        return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <FamilyDashboard />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("+ Add family member")).toBeDefined();
    });
  });

  it("shows nag count badge for each member", async () => {
    store["nagz_family_id"] = "fam-1";
    const members: Member[] = [
      { user_id: "user-1", display_name: "Alice", family_id: "fam-1", role: "guardian", status: "active", joined_at: "2026-01-01T00:00:00Z" },
      { user_id: "user-2", display_name: "Bob", family_id: "fam-1", role: "child", status: "active", joined_at: "2026-01-01T00:00:00Z" },
    ];
    const nags = [
      { id: "n1", family_id: "fam-1", creator_id: "user-1", recipient_id: "user-2", category: "chores", done_definition: "ack_only", status: "open", due_at: "2026-03-01T10:00:00Z", created_at: "2026-02-01T10:00:00Z", strategy_template: "default" },
      { id: "n2", family_id: "fam-1", creator_id: "user-1", recipient_id: "user-2", category: "meds", done_definition: "ack_only", status: "open", due_at: "2026-03-01T10:00:00Z", created_at: "2026-02-01T10:00:00Z", strategy_template: "default" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: members, total: 2 });
      if (config.url.includes("/families/fam-1") && !config.url.includes("/members")) {
        return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      }
      if (config.url.includes("/nags")) return Promise.resolve({ items: nags, total: 2 });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <FamilyDashboard />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("2")).toBeDefined(); // Bob has 2 nags
    });
    expect(screen.getByText("0")).toBeDefined(); // Alice has 0 nags
  });

  it("shows Logout button", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/fam-1")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <FamilyDashboard />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Logout")).toBeDefined();
    });
  });
});

// ===================================================
// 6. KidView Component
// ===================================================

import KidView from "../components/KidView";

describe("KidView", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
  });

  it("shows 'No family selected' when no family_id", () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <KidView />
      </Providers>
    );
    expect(screen.getByText("No family selected.")).toBeDefined();
  });

  it("shows loading state initially", () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation(() => new Promise(() => {}));
    render(
      <Providers>
        <KidView />
      </Providers>
    );
    expect(screen.getByText("Loading nagz...")).toBeDefined();
  });

  it("renders nags as cards with category and due date", async () => {
    store["nagz_family_id"] = "fam-1";
    const nags = [
      {
        id: "nag-1", family_id: "fam-1", creator_id: "user-2", recipient_id: "user-1",
        category: "homework", done_definition: "ack_only", status: "open",
        due_at: "2026-03-01T10:00:00Z", created_at: "2026-02-01T10:00:00Z",
        description: "Finish math",
        strategy_template: "default",
      },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/excuses")) return Promise.resolve({ items: [] });
      if (config.url.includes("/escalation")) return Promise.resolve({ current_phase: "phase_0_initial", computed_at: "2026-02-01T10:00:00Z" });
      return Promise.resolve({ items: nags, total: 1 });
    });
    render(
      <Providers>
        <KidView />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("homework")).toBeDefined();
    });
    expect(screen.getByText("Finish math")).toBeDefined();
  });

  it("shows 'No nagz found' when user has no nags", async () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(
      <Providers>
        <KidView />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("No nagz found.")).toBeDefined();
    });
  });

  it("shows filter buttons with counts", async () => {
    store["nagz_family_id"] = "fam-1";
    const nags = [
      { id: "n1", family_id: "fam-1", creator_id: "user-2", recipient_id: "user-1", category: "chores", done_definition: "ack_only", status: "open", due_at: "2026-03-01T10:00:00Z", created_at: "2026-02-01T10:00:00Z", strategy_template: "default" },
      { id: "n2", family_id: "fam-1", creator_id: "user-2", recipient_id: "user-1", category: "meds", done_definition: "ack_only", status: "completed", due_at: "2026-03-01T10:00:00Z", created_at: "2026-02-01T10:00:00Z", strategy_template: "default" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/excuses")) return Promise.resolve({ items: [] });
      return Promise.resolve({ items: nags, total: 2 });
    });
    render(
      <Providers>
        <KidView />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("All (2)")).toBeDefined();
    });
    expect(screen.getByText("open (1)")).toBeDefined();
    expect(screen.getByText("completed (1)")).toBeDefined();
    expect(screen.getByText("missed (0)")).toBeDefined();
  });

  it("shows Mark Complete and Submit Excuse for own nags", async () => {
    store["nagz_family_id"] = "fam-1";
    const nags = [
      { id: "n1", family_id: "fam-1", creator_id: "user-2", recipient_id: "user-1", category: "chores", done_definition: "ack_only", status: "open", due_at: "2026-03-01T10:00:00Z", created_at: "2026-02-01T10:00:00Z", strategy_template: "default" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/excuses")) return Promise.resolve({ items: [] });
      if (config.url.includes("/escalation")) return Promise.resolve({ current_phase: "phase_0_initial", computed_at: "2026-02-01T10:00:00Z" });
      return Promise.resolve({ items: nags, total: 1 });
    });
    render(
      <Providers>
        <KidView />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Mark Complete")).toBeDefined();
    });
    expect(screen.getByText("Submit Excuse")).toBeDefined();
  });

  it("shows excuses for nags that have them", async () => {
    store["nagz_family_id"] = "fam-1";
    const nags = [
      { id: "n1", family_id: "fam-1", creator_id: "user-2", recipient_id: "user-1", category: "chores", done_definition: "ack_only", status: "open", due_at: "2026-03-01T10:00:00Z", created_at: "2026-02-01T10:00:00Z", strategy_template: "default" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/excuses")) return Promise.resolve({ items: [{ summary: "I was busy", at: "2026-02-15T10:00:00Z" }] });
      if (config.url.includes("/escalation")) return Promise.resolve({ current_phase: "phase_0_initial", computed_at: "2026-02-01T10:00:00Z" });
      return Promise.resolve({ items: nags, total: 1 });
    });
    render(
      <Providers>
        <KidView />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Excuses (1)")).toBeDefined();
    });
    expect(screen.getByText("I was busy")).toBeDefined();
  });

  it("shows escalation phase badge for open nags", async () => {
    store["nagz_family_id"] = "fam-1";
    const nags = [
      { id: "n1", family_id: "fam-1", creator_id: "user-2", recipient_id: "user-1", category: "chores", done_definition: "ack_only", status: "open", due_at: "2026-03-01T10:00:00Z", created_at: "2026-02-01T10:00:00Z", strategy_template: "default" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: [], total: 0 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      if (config.url.includes("/excuses")) return Promise.resolve({ items: [] });
      if (config.url.includes("/escalation")) return Promise.resolve({ current_phase: "phase_2_overdue_soft", computed_at: "2026-02-01T10:00:00Z" });
      return Promise.resolve({ items: nags, total: 1 });
    });
    render(
      <Providers>
        <KidView />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Overdue")).toBeDefined();
    });
  });
});

// ===================================================
// 7. CreateNag Component (Modal)
// ===================================================

import { CreateNagModal } from "../components/CreateNag";

describe("CreateNagModal", () => {
  beforeEach(() => {
    sessionStore["nagz_token"] = "dev:user-1";
  });

  it("renders the create form with required fields", () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <CreateNagModal
          familyId="fam-1"
          onClose={() => {}}
          onCreated={() => {}}
        />
      </Providers>
    );
    // "Create Nagz" appears in both h3 and submit button
    const headings = screen.getAllByText("Create Nagz");
    expect(headings.length).toBe(2);
    expect(screen.getByText("Recipient")).toBeDefined();
    expect(screen.getByText("Category")).toBeDefined();
    expect(screen.getByText("Done Definition")).toBeDefined();
    expect(screen.getByText("Description")).toBeDefined();
    expect(screen.getByText("Repeat")).toBeDefined();
    expect(screen.getByText("Due Date & Time")).toBeDefined();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <CreateNagModal
          familyId="fam-1"
          onClose={onClose}
          onCreated={() => {}}
        />
      </Providers>
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has a submit button with correct label", () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <CreateNagModal
          familyId="fam-1"
          onClose={() => {}}
          onCreated={() => {}}
        />
      </Providers>
    );
    const submitBtn = screen.getAllByText("Create Nagz").find(
      (el) => el.tagName === "BUTTON" && el.getAttribute("type") === "submit"
    );
    expect(submitBtn).toBeDefined();
  });

  it("populates members in recipient dropdown", async () => {
    store["nagz_family_id"] = "fam-1";
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
        <CreateNagModal
          familyId="fam-1"
          onClose={() => {}}
          onCreated={() => {}}
        />
      </Providers>
    );
    await waitFor(() => {
      expect(screen.getByText("Alice (guardian)")).toBeDefined();
    });
    expect(screen.getByText("Bob (child)")).toBeDefined();
  });

  it("pre-selects recipient when recipientId is provided and member exists", async () => {
    store["nagz_family_id"] = "fam-1";
    const members: Member[] = [
      { user_id: "user-2", display_name: "Bob", family_id: "fam-1", role: "child", status: "active", joined_at: "2026-01-01T00:00:00Z" },
    ];
    (customInstance as Mock).mockImplementation((config: { url: string }) => {
      if (config.url.includes("/members")) return Promise.resolve({ items: members, total: 1 });
      if (config.url.includes("/families/")) return Promise.resolve({ family_id: "fam-1", name: "F", invite_code: null });
      return Promise.resolve({ items: [], total: 0 });
    });
    const { container } = render(
      <Providers>
        <CreateNagModal
          familyId="fam-1"
          recipientId="user-2"
          onClose={() => {}}
          onCreated={() => {}}
        />
      </Providers>
    );
    // Wait for the member option to appear in the dropdown
    await waitFor(() => {
      expect(screen.getByText("Bob (child)")).toBeDefined();
    });
    // The first select (recipient) should have user-2 as its value
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("user-2");
  });
});

// ===================================================
// 8. CreateNag route component
// ===================================================

import CreateNag from "../components/CreateNag";

describe("CreateNag (route wrapper)", () => {
  it("shows 'No family selected' when no family_id", () => {
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <CreateNag />
      </Providers>
    );
    expect(screen.getByText("No family selected.")).toBeDefined();
  });

  it("renders the create nag modal when family_id exists", () => {
    store["nagz_family_id"] = "fam-1";
    (customInstance as Mock).mockResolvedValue({ items: [], total: 0 });
    render(
      <Providers>
        <CreateNag />
      </Providers>
    );
    // "Create Nagz" appears in both heading and submit button
    const elements = screen.getAllByText("Create Nagz");
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });
});

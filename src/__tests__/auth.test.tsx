import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../auth";

// Mock localStorage
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

function TestConsumer() {
  const { token, userId, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="token">{token ?? "null"}</span>
      <span data-testid="userId">{userId ?? "null"}</span>
      <button onClick={() => login("dev:abc-123")}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    vi.clearAllMocks();
  });

  it("starts with null token when nothing in localStorage", () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByTestId("token").textContent).toBe("null");
    expect(screen.getByTestId("userId").textContent).toBe("null");
  });

  it("restores token from localStorage", () => {
    store["nagz_token"] = "dev:user-1";
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByTestId("token").textContent).toBe("dev:user-1");
    expect(screen.getByTestId("userId").textContent).toBe("user-1");
  });

  it("login saves token and extracts userId", () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    act(() => {
      screen.getByText("Login").click();
    });
    expect(screen.getByTestId("token").textContent).toBe("dev:abc-123");
    expect(screen.getByTestId("userId").textContent).toBe("abc-123");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("nagz_token", "dev:abc-123");
  });

  it("logout clears token", () => {
    store["nagz_token"] = "dev:user-1";
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    act(() => {
      screen.getByText("Logout").click();
    });
    expect(screen.getByTestId("token").textContent).toBe("null");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("nagz_token");
  });
});

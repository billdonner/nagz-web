import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../components/ErrorBoundary";

// Suppress React's default error boundary console.error noise in test output
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

function GoodChild() {
  return <p>All is well</p>;
}

function BadChild(): never {
  throw new Error("Boom!");
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("All is well")).toBeDefined();
  });

  it("shows error message when a child throws", () => {
    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByText("Boom!")).toBeDefined();
  });

  it("shows a reload button when a child throws", () => {
    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>
    );
    const button = screen.getByRole("button", { name: "Reload" });
    expect(button).toBeDefined();
  });
});

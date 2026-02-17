import { describe, it, expect } from "vitest";
import { extractErrorMessage } from "../api/axios-instance";

/** Helper to build an object that passes axios.isAxiosError(). */
function makeAxiosError(opts: {
  responseData?: unknown;
  status?: number;
  code?: string;
  message?: string;
}) {
  return {
    isAxiosError: true, // axios.isAxiosError checks for this property
    name: "AxiosError",
    message: opts.message ?? "Request failed",
    code: opts.code,
    response: opts.responseData !== undefined
      ? { status: opts.status ?? 400, data: opts.responseData }
      : undefined,
    toJSON: () => ({}),
  };
}

describe("extractErrorMessage", () => {
  it("returns error.message from ErrorEnvelope format", () => {
    const err = makeAxiosError({
      responseData: { error: { message: "Nag not found" } },
      status: 404,
    });
    expect(extractErrorMessage(err)).toBe("Nag not found");
  });

  it("returns detail string from FastAPI format", () => {
    const err = makeAxiosError({
      responseData: { detail: "Invalid credentials" },
      status: 401,
    });
    expect(extractErrorMessage(err)).toBe("Invalid credentials");
  });

  it("joins detail array of {msg} objects from FastAPI validation errors", () => {
    const err = makeAxiosError({
      responseData: {
        detail: [
          { msg: "field required", loc: ["body", "name"] },
          { msg: "invalid email", loc: ["body", "email"] },
        ],
      },
      status: 422,
    });
    expect(extractErrorMessage(err)).toBe("field required; invalid email");
  });

  it("returns network error message when no response and code is ERR_NETWORK", () => {
    const err = makeAxiosError({
      code: "ERR_NETWORK",
      message: "Network Error",
    });
    expect(extractErrorMessage(err)).toBe("Network error. Please check your connection.");
  });

  it("returns timeout message when code is ECONNABORTED", () => {
    const err = makeAxiosError({
      code: "ECONNABORTED",
      message: "timeout of 30000ms exceeded",
    });
    expect(extractErrorMessage(err)).toBe("Request timed out. Please try again.");
  });

  it("returns default fallback for a non-Axios error", () => {
    const err = new Error("some random error");
    expect(extractErrorMessage(err)).toBe("Something went wrong.");
  });

  it("returns custom fallback for a non-Axios error when provided", () => {
    const err = new TypeError("undefined is not a function");
    expect(extractErrorMessage(err, "Custom fallback")).toBe("Custom fallback");
  });

  it("returns fallback when detail array has no msg fields", () => {
    const err = makeAxiosError({
      responseData: { detail: [{ type: "missing" }] },
      status: 422,
    });
    expect(extractErrorMessage(err)).toBe("Something went wrong.");
  });

  it("returns fallback when response data has no recognized fields", () => {
    const err = makeAxiosError({
      responseData: { foo: "bar" },
      status: 500,
    });
    expect(extractErrorMessage(err)).toBe("Something went wrong.");
  });
});

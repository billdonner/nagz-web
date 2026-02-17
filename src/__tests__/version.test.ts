import { describe, it, expect } from "vitest";
import { parseVersion, compareVersions, evaluate } from "../version";

describe("parseVersion", () => {
  it("parses a standard semver string", () => {
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
  });

  it("parses a version with zeros", () => {
    expect(parseVersion("0.0.1")).toEqual([0, 0, 1]);
  });

  it("handles missing parts", () => {
    expect(parseVersion("1")).toEqual([1, 0, 0]);
    expect(parseVersion("2.1")).toEqual([2, 1, 0]);
  });
});

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions([1, 0, 0], [1, 0, 0])).toBe(0);
  });

  it("returns positive when a > b", () => {
    expect(compareVersions([2, 0, 0], [1, 0, 0])).toBeGreaterThan(0);
    expect(compareVersions([1, 1, 0], [1, 0, 0])).toBeGreaterThan(0);
    expect(compareVersions([1, 0, 1], [1, 0, 0])).toBeGreaterThan(0);
  });

  it("returns negative when a < b", () => {
    expect(compareVersions([1, 0, 0], [2, 0, 0])).toBeLessThan(0);
    expect(compareVersions([1, 0, 0], [1, 1, 0])).toBeLessThan(0);
  });
});

describe("evaluate", () => {
  it("returns compatible when client meets server version", () => {
    const result = evaluate("1.0.0", "1.0.0");
    expect(result.kind).toBe("compatible");
  });

  it("returns update_required when client is below minimum", () => {
    const result = evaluate("2.0.0", "1.5.0");
    expect(result.kind).toBe("update_required");
    if (result.kind === "update_required") {
      expect(result.minRequired).toBe("1.5.0");
    }
  });

  it("returns update_recommended when server has newer major version", () => {
    const result = evaluate("2.0.0", "1.0.0");
    expect(result.kind).toBe("update_recommended");
    if (result.kind === "update_recommended") {
      expect(result.serverAPI).toBe("2.0.0");
    }
  });

  it("returns compatible for same major with newer minor", () => {
    const result = evaluate("1.2.0", "1.0.0");
    expect(result.kind).toBe("compatible");
  });
});

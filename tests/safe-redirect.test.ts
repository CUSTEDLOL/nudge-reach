import { describe, it, expect } from "vitest";
import { safeRelativePath } from "@/lib/safe-redirect";

describe("safeRelativePath — open-redirect guard", () => {
  it("keeps a normal same-site path", () => {
    expect(safeRelativePath("/dashboard")).toBe("/dashboard");
    expect(safeRelativePath("/settings/billing?x=1")).toBe(
      "/settings/billing?x=1"
    );
  });

  it("falls back for external / protocol-relative / backslash / encoded tricks", () => {
    for (const bad of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "http://evil.com",
      "/%2f%2fevil.com",
      "/%2F/evil.com",
      "/%5cevil.com",
      "javascript:alert(1)",
      "evil.com",
    ]) {
      expect(safeRelativePath(bad)).toBe("/dashboard");
    }
  });

  it("falls back for null / empty / undefined", () => {
    expect(safeRelativePath(null)).toBe("/dashboard");
    expect(safeRelativePath("")).toBe("/dashboard");
    expect(safeRelativePath(undefined)).toBe("/dashboard");
  });

  it("honors a custom fallback", () => {
    expect(safeRelativePath("//evil.com", "/login")).toBe("/login");
  });
});

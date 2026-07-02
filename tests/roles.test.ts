import { describe, expect, it } from "vitest";
import { hasRole, requireRole, type OrgContext } from "@/lib/auth";

const ctx = (role: OrgContext["role"]) => ({ role }) as OrgContext;

describe("hasRole (OWNER > ADMIN > AGENT)", () => {
  it("every role meets its own level", () => {
    expect(hasRole("OWNER", "OWNER")).toBe(true);
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasRole("AGENT", "AGENT")).toBe(true);
  });

  it("OWNER outranks everything", () => {
    expect(hasRole("OWNER", "ADMIN")).toBe(true);
    expect(hasRole("OWNER", "AGENT")).toBe(true);
  });

  it("ADMIN outranks AGENT but not OWNER", () => {
    expect(hasRole("ADMIN", "AGENT")).toBe(true);
    expect(hasRole("ADMIN", "OWNER")).toBe(false);
  });

  it("AGENT outranks nothing above itself", () => {
    expect(hasRole("AGENT", "ADMIN")).toBe(false);
    expect(hasRole("AGENT", "OWNER")).toBe(false);
  });
});

describe("requireRole", () => {
  it("passes silently when the role is sufficient", () => {
    expect(() => requireRole(ctx("OWNER"), "ADMIN")).not.toThrow();
    expect(() => requireRole(ctx("ADMIN"), "ADMIN")).not.toThrow();
    expect(() => requireRole(ctx("AGENT"), "AGENT")).not.toThrow();
  });

  it("throws a user-safe message when the role is insufficient", () => {
    expect(() => requireRole(ctx("AGENT"), "ADMIN")).toThrow(
      /Only an admin or above can do this/
    );
    expect(() => requireRole(ctx("ADMIN"), "OWNER")).toThrow(
      /Only the workspace owner or above can do this/
    );
  });
});

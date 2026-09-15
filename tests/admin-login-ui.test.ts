import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loginPath = "src/components/features/admin-shell/admin-login.tsx";
const loginSource = existsSync(loginPath) ? readFileSync(loginPath, "utf8") : "";
const shellSource = readFileSync(
  "src/components/features/admin-shell/admin-shell.tsx",
  "utf8"
);
const layoutSource = readFileSync("src/app/admin/layout.tsx", "utf8");
const pageSource = readFileSync("src/app/admin/page.tsx", "utf8");

describe("founder login UI", () => {
  it("uses the real Nudge logo and an accessible email/password action form", () => {
    expect(loginSource).toContain('"use client"');
    expect(loginSource).toContain("useActionState");
    expect(loginSource).toContain("loginFounderAction");
    expect(loginSource).toContain('src="/logo-mark.png"');
    expect(loginSource).toContain('name="email"');
    expect(loginSource).toContain('autoComplete="email"');
    expect(loginSource).toContain('name="password"');
    expect(loginSource).toContain('autoComplete="current-password"');
    expect(loginSource).toContain('aria-live="polite"');
    expect(loginSource).toContain("pending");
  });

  it("signs out through the isolated founder route", () => {
    expect(shellSource).toContain('action="/admin/signout"');
    expect(shellSource).not.toContain('action="/auth/signout"');
    expect(shellSource).toContain('aria-label="Sign out of founder portal"');
  });

  it("does not query or render the admin shell before layout authorization", () => {
    const founderCheck = layoutSource.indexOf("getFounderContext()");
    const signedOutBranch = layoutSource.indexOf("if (!founder)");
    const leadQuery = layoutSource.indexOf("newLeadsCount()");

    expect(founderCheck).toBeGreaterThan(-1);
    expect(signedOutBranch).toBeGreaterThan(founderCheck);
    expect(leadQuery).toBeGreaterThan(signedOutBranch);
  });

  it("shows login before the root page starts cross-organization queries", () => {
    const founderCheck = pageSource.indexOf("getFounderContext()");
    const loginRender = pageSource.indexOf("<AdminLogin />");
    const overviewQuery = pageSource.indexOf("overviewStats(days)");

    expect(founderCheck).toBeGreaterThan(-1);
    expect(loginRender).toBeGreaterThan(founderCheck);
    expect(overviewQuery).toBeGreaterThan(loginRender);
  });
});

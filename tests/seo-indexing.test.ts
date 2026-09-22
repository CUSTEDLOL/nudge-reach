import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { metadata as appMetadata } from "@/app/(app)/layout";
import { metadata as loginMetadata } from "@/app/login/page";
import { isPublicPath } from "@/lib/supabase/proxy-session";

describe("SEO indexing controls", () => {
  it("allows crawlers to read HTML noindex directives", () => {
    const disallow = robots().rules;
    const text = JSON.stringify(disallow);

    expect(text).toContain("/api/");
    expect(text).toContain("/auth/");
    expect(text).not.toContain("/login");
    expect(text).not.toContain("/dashboard");
  });

  it("marks login and the authenticated app shell noindex", () => {
    expect(loginMetadata.robots).toMatchObject({ index: false, follow: false });
    expect(appMetadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("makes every planned marketing route family public", () => {
    for (const path of [
      "/industries",
      "/features",
      "/compare",
      "/resources",
      "/how-it-works",
      "/whatsapp-ai-automation",
      "/tools",
    ]) {
      expect(isPublicPath(path)).toBe(true);
      expect(isPublicPath(`${path}/example`)).toBe(true);
    }

    expect(isPublicPath("/tools/whatsapp-lead-leakage-calculator")).toBe(true);
  });

  it("keeps lookalike protected paths private", () => {
    expect(isPublicPath("/resources-private")).toBe(false);
    expect(isPublicPath("/tools-private")).toBe(false);
  });
});

/**
 * Every public marketing route must be in the proxy's allowlist. Anything
 * missing does NOT 404 — it 307s signed-out visitors to /login, so the page
 * looks like it exists in the build and is unreachable in production. That is
 * exactly how /contact shipped: built fine, redirected everyone.
 */
describe("marketing routes are reachable when signed out", () => {
  it("treats every marketing page as public", () => {
    for (const path of [
      "/contact",
      "/free-trial",
      "/pricing",
      "/faq",
      "/resources",
      "/industries/clinics",
      "/privacy",
      "/terms",
    ]) {
      expect(isPublicPath(path), `${path} redirects to /login`).toBe(true);
    }
  });

  it("still protects the signed-in app", () => {
    for (const path of ["/dashboard", "/inbox", "/settings/whatsapp", "/admin/orgs"]) {
      expect(isPublicPath(path), `${path} must stay private`).toBe(false);
    }
  });
});

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
    ]) {
      expect(isPublicPath(path)).toBe(true);
      expect(isPublicPath(`${path}/example`)).toBe(true);
    }
  });

  it("keeps lookalike protected paths private", () => {
    expect(isPublicPath("/resources-private")).toBe(false);
  });
});

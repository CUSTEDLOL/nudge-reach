import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  buildBusinessInfo,
  verticalPackFor,
} from "@/modules/concierge";
import { campaignContentSchema } from "@/modules/campaign/schema";
import { buildAgentSystemPrompt } from "@/modules/agent/prompt";

describe("buildBusinessInfo", () => {
  it("composes labelled sections and drops empty ones", () => {
    const info = buildBusinessInfo({
      hours: "Mon–Sat 10–8",
      services: "Haircut\nColour",
      prices: "",
      faqs: "Q: Walk-ins? A: Yes",
    });
    expect(info).toContain("HOURS:\nMon–Sat 10–8");
    expect(info).toContain("SERVICES:\nHaircut\nColour");
    expect(info).toContain("FAQs:\nQ: Walk-ins? A: Yes");
    expect(info).not.toContain("PRICES");
  });

  it("returns empty string when nothing is provided", () => {
    expect(buildBusinessInfo({})).toBe("");
  });
});

describe("vertical template packs (clinic/salon)", () => {
  for (const vertical of ["clinic", "salon"]) {
    it(`${vertical} pack is valid, single-{{1}}, opt-out-compliant marketing`, () => {
      const pack = verticalPackFor(vertical);
      expect(pack.length).toBeGreaterThan(0);
      for (const t of pack) {
        expect(campaignContentSchema.safeParse(t.content).success).toBe(true);
        expect(t.name).toMatch(/^[a-z0-9_]+$/);
        expect((t.content.body.match(/\{\{1\}\}/g) ?? []).length).toBe(1);
        expect(t.category).toBe("MARKETING");
        expect(t.content.footer.toLowerCase()).toContain("stop");
      }
    });
  }

  it("unknown vertical yields an empty pack", () => {
    expect(verticalPackFor("restaurant")).toEqual([]);
  });
});

describe("salon agent scope (added in 5.3)", () => {
  it("a salon profile is scoped as a salon, not the restaurant fallback", () => {
    const p = buildAgentSystemPrompt({
      vertical: "salon",
      businessName: "Glow Salon",
      businessInfo: "Haircut ₹400",
      tone: "Warm",
      doNots: "",
    });
    expect(p).toContain("salon");
    expect(p).toContain("stylists");
  });
});

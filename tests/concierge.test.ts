import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  buildBusinessInfo,
  STARTER_PACK,
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

describe("concierge starter pack", () => {
  it("is valid, single-{{1}}, opt-out-compliant marketing", () => {
    expect(STARTER_PACK.length).toBeGreaterThan(0);
    for (const t of STARTER_PACK) {
      expect(campaignContentSchema.safeParse(t.content).success).toBe(true);
      expect(t.name).toMatch(/^[a-z0-9_]+$/);
      expect((t.content.body.match(/\{\{1\}\}/g) ?? []).length).toBe(1);
      expect(t.category).toBe("MARKETING");
      expect(t.content.footer.toLowerCase()).toContain("stop");
    }
  });

  it("assumes no industry — no clinic, salon, menu or appointment wording", () => {
    const text = JSON.stringify(STARTER_PACK).toLowerCase();
    for (const word of ["clinic", "salon", "stylist", "check-up", "menu", "appointment", "patient"]) {
      expect(text).not.toContain(word);
    }
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

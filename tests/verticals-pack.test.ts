import { describe, expect, it } from "vitest";
import { PACKS, PACK_IDS } from "@/modules/verticals";
import { TEMPLATE_KINDS } from "@/modules/verticals/types";
import { isVertical } from "@/modules/dashboard/verticals";
import { KNOWLEDGE_CATEGORIES } from "@/modules/knowledge/digest";

/**
 * Pack integrity (PLAN.md WS3): every pack must be complete, Meta-safe,
 * serializable DATA. A pack that fails here would break onboarding, template
 * review, /inbox/try or the eval gate at runtime — so the suite fails first.
 */

const packs = Object.values(PACKS);

describe("vertical pack registry", () => {
  it("has unique ids that are valid VERTICALS values", () => {
    expect(new Set(PACK_IDS).size).toBe(PACK_IDS.length);
    for (const pack of packs) {
      expect(isVertical(pack.id), `${pack.id} missing from VERTICALS`).toBe(true);
      expect(pack.id).toBe(
        Object.keys(PACKS).find((k) => PACKS[k] === pack)
      );
    }
  });

  it("packs are pure serializable data", () => {
    for (const pack of packs) {
      expect(() => structuredClone(pack)).not.toThrow();
    }
  });
});

describe.each(packs.map((p) => [p.id, p] as const))("pack %s", (_id, pack) => {
  it("covers all six template kinds with valid Meta-safe templates", () => {
    const kinds = new Set(Object.values(pack.templateKindByName));
    for (const kind of TEMPLATE_KINDS) {
      expect(kinds, `missing template kind ${kind}`).toContain(kind);
    }
    const names = pack.templates.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of Object.keys(pack.templateKindByName)) {
      expect(names, `templateKindByName maps unknown template ${name}`).toContain(name);
    }
    for (const t of pack.templates) {
      expect(t.name).toMatch(/^[a-z0-9_]+$/);
      expect(t.content.body.length).toBeLessThanOrEqual(1024);
      expect(t.content.header.length).toBeLessThanOrEqual(60);
      expect(t.content.footer.length).toBeLessThanOrEqual(60);
      expect(t.content.body, `${t.name} missing {{1}}`).toContain("{{1}}");
      expect(t.content.body, `${t.name} has extra placeholders`).not.toMatch(/\{\{[2-9]\}\}/);
      if (t.category === "MARKETING") {
        expect(t.content.footer, `${t.name} MARKETING footer needs STOP`).toMatch(/stop/i);
      }
    }
  });

  it("has enough eval cases with unique ids and checks", () => {
    expect(pack.evalCases.length).toBeGreaterThanOrEqual(15);
    const ids = pack.evalCases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of pack.evalCases) {
      expect(c.turns.length).toBeGreaterThan(0);
      expect(Object.keys(c.checks).length, `${c.id} has no checks`).toBeGreaterThan(0);
    }
  });

  it("has at least five sample conversations opening with the customer", () => {
    expect(pack.sampleConversations.length).toBeGreaterThanOrEqual(5);
    for (const convo of pack.sampleConversations) {
      expect(convo.turns.length).toBeGreaterThan(0);
      expect(convo.turns[0].role).toBe("customer");
    }
  });

  it("has a substantial knowledge schema with valid categories and unique ids", () => {
    const min = pack.id === "study_abroad" ? 10 : 8;
    expect(pack.knowledgeSchema.length).toBeGreaterThanOrEqual(min);
    const ids = pack.knowledgeSchema.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of pack.knowledgeSchema) {
      expect(KNOWLEDGE_CATEGORIES).toContain(q.category);
      expect(q.prompt.length).toBeGreaterThan(10);
    }
  });

  it("has sane booking types", () => {
    expect(pack.bookingTypes.length).toBeGreaterThan(0);
    const keys = pack.bookingTypes.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const b of pack.bookingTypes) {
      expect(b.minutes).toBeGreaterThanOrEqual(10);
      expect(b.minutes).toBeLessThanOrEqual(480);
    }
  });

  it("keeps evalProfile prices consistent with its own grounding text", () => {
    expect(pack.evalProfile.allowedPrices.length).toBeGreaterThan(0);
    for (const match of pack.evalProfile.businessInfo.matchAll(/₹\s?([\d,]+)/g)) {
      const amount = Number(match[1].replaceAll(",", ""));
      expect(
        pack.evalProfile.allowedPrices,
        `₹${amount} appears in businessInfo but not allowedPrices`
      ).toContain(amount);
    }
  });

  it("has a prompt fragment and follow-up config", () => {
    expect(pack.promptFragment.trim().length).toBeGreaterThan(50);
    expect(pack.followUp.leadNudgeWaitsMinutes).toHaveLength(2);
    for (const w of pack.followUp.leadNudgeWaitsMinutes) {
      expect(w).toBeGreaterThan(0);
    }
    expect(pack.version).toBeGreaterThanOrEqual(1);
  });
});

import { describe, expect, it } from "vitest";
import {
  extractJson,
  repairAndValidate,
  repairOptOutFooter,
  repairPersonalization,
} from "@/modules/campaign/guardrails";

describe("extractJson (defensive parsing)", () => {
  it("parses clean JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("strips markdown code fences", () => {
    const result = extractJson('```json\n{"a":1}\n```');
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("ignores prose around the JSON object", () => {
    const result = extractJson('Here is your campaign:\n{"a":1}\nHope it helps!');
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("fails gracefully on garbage", () => {
    expect(extractJson("no json here").ok).toBe(false);
    expect(extractJson("{broken").ok).toBe(false);
  });
});

describe("repairPersonalization ({{1}} exactly once)", () => {
  it("keeps a single {{1}} untouched", () => {
    expect(repairPersonalization("Hi {{1}}, sale!")).toBe("Hi {{1}}, sale!");
  });
  it("prepends greeting when {{1}} is missing", () => {
    expect(repairPersonalization("Big sale this week.")).toBe(
      "Hi {{1}}! Big sale this week."
    );
  });
  it("removes duplicate {{1}}s, keeping the first", () => {
    expect(repairPersonalization("Hi {{1}}, {{1}} sale!")).toBe(
      "Hi {{1}},  sale!"
    );
  });
});

describe("repairOptOutFooter (mandatory opt-out)", () => {
  it("keeps a footer that already has STOP", () => {
    expect(repairOptOutFooter("Reply STOP to unsubscribe")).toBe(
      "Reply STOP to unsubscribe"
    );
  });
  it("appends opt-out to a short custom footer", () => {
    expect(repairOptOutFooter("Sharma Boutique")).toBe(
      "Sharma Boutique · Reply STOP to unsubscribe"
    );
  });
  it("replaces a long footer rather than exceed 60 chars", () => {
    const long = "Sharma Boutique — the best ethnic wear in all of Jaipur city";
    expect(repairOptOutFooter(long)).toBe("Reply STOP to unsubscribe");
  });
  it("fills an empty footer", () => {
    expect(repairOptOutFooter("")).toBe("Reply STOP to unsubscribe");
  });
});

describe("repairAndValidate (full §7 shape)", () => {
  const valid = {
    productName: "Summer Kurta",
    campaignAngle: "Festival urgency",
    header: "New kurtas just landed",
    body: "Hi {{1}}, our summer kurtas are 20% off this week only.",
    footer: "Reply STOP to unsubscribe",
    buttons: [
      { type: "URL", text: "Shop now", url: "https://shop.example.com" },
      { type: "QUICK_REPLY", text: "Send catalog" },
    ],
    sampleName: "Priya",
    imageTreatment: "Natural light, front-on",
    notes: "Send before 6pm",
  };

  it("accepts a fully valid object", () => {
    expect(repairAndValidate(valid).productName).toBe("Summer Kurta");
  });

  it("repairs a missing opt-out and missing {{1}} instead of failing", () => {
    const repaired = repairAndValidate({
      ...valid,
      body: "Summer kurtas 20% off.",
      footer: "Sharma Boutique",
    });
    expect(repaired.body).toContain("{{1}}");
    expect(repaired.footer.toLowerCase()).toContain("stop");
  });

  it("truncates an over-long header to 60 chars", () => {
    const repaired = repairAndValidate({
      ...valid,
      header: "x".repeat(80),
    });
    expect(repaired.header).toHaveLength(60);
  });

  it("caps buttons at 3", () => {
    const repaired = repairAndValidate({
      ...valid,
      buttons: [
        { type: "QUICK_REPLY", text: "A" },
        { type: "QUICK_REPLY", text: "B" },
        { type: "QUICK_REPLY", text: "C" },
        { type: "QUICK_REPLY", text: "D" },
      ],
    });
    expect(repaired.buttons).toHaveLength(3);
  });

  it("throws a readable error on hopeless input", () => {
    expect(() => repairAndValidate("not an object")).toThrow(/invalid/i);
  });
});

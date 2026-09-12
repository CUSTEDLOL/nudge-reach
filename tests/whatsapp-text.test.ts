import { describe, expect, it } from "vitest";
import { normalizeWhatsAppMarkdown, whatsAppSegments } from "@/modules/inbox/format";

/** The model writes Markdown; WhatsApp bolds with single asterisks and the
 * inbox renders segments. No customer should ever see literal "**". */

describe("normalizeWhatsAppMarkdown", () => {
  it("converts Markdown bold/italics to WhatsApp marks", () => {
    expect(normalizeWhatsAppMarkdown("Our **classic facial** is ₹1,200")).toBe(
      "Our *classic facial* is ₹1,200"
    );
    expect(normalizeWhatsAppMarkdown("__tomorrow__ works")).toBe("_tomorrow_ works");
  });

  it("strips heading hashes and leaves plain text alone", () => {
    expect(normalizeWhatsAppMarkdown("### Timings\nMon-Sat")).toBe("Timings\nMon-Sat");
    expect(normalizeWhatsAppMarkdown("Plain text, 5 * 3 = 15")).toBe(
      "Plain text, 5 * 3 = 15"
    );
  });
});

describe("whatsAppSegments", () => {
  it("splits *bold* and _italic_ runs", () => {
    expect(whatsAppSegments("Open *till 10 PM* daily")).toEqual([
      { text: "Open " },
      { text: "till 10 PM", bold: true },
      { text: " daily" },
    ]);
    expect(whatsAppSegments("see _you_ soon")).toEqual([
      { text: "see " },
      { text: "you", italic: true },
      { text: " soon" },
    ]);
  });

  it("leaves math and unbalanced marks literal", () => {
    expect(whatsAppSegments("5 * 3 = 15 * fun")).toEqual([{ text: "5 * 3 = 15 * fun" }]);
    expect(whatsAppSegments("*dangling")).toEqual([{ text: "*dangling" }]);
    expect(whatsAppSegments("")).toEqual([]);
  });
});

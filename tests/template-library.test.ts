import { describe, expect, it } from "vitest";
import {
  buildLibraryComponents,
  normalizeLibraryContent,
  type LibraryContentInput,
} from "@/modules/whatsapp/library";

const baseInput: LibraryContentInput = {
  displayName: "Diwali Offer",
  headerType: "text",
  headerText: "Diwali sale is live 🪔",
  headerImageUrl: "",
  body: "Hi {{1}}, flat 20% off all silk sarees this week only.",
  footer: "",
  sampleName: "Priya",
  buttons: [],
};

describe("normalizeLibraryContent (library template compliance)", () => {
  it("appends the opt-out footer for MARKETING templates", () => {
    const content = normalizeLibraryContent(baseInput, "MARKETING");
    expect(content.footer).toBe("Reply STOP to unsubscribe");
  });

  it("keeps a custom marketing footer but enforces the STOP instruction", () => {
    const content = normalizeLibraryContent(
      { ...baseInput, footer: "Thanks for shopping" },
      "MARKETING"
    );
    expect(content.footer).toMatch(/stop/i);
  });

  it("leaves UTILITY footers alone (opt-out lock is marketing-only)", () => {
    const content = normalizeLibraryContent(
      { ...baseInput, footer: "Order ref included above" },
      "UTILITY"
    );
    expect(content.footer).toBe("Order ref included above");
  });

  it("allows an empty footer for non-marketing categories", () => {
    const content = normalizeLibraryContent(baseInput, "AUTHENTICATION");
    expect(content.footer).toBe("");
  });

  it("caps buttons at 3 and defaults missing URL button links", () => {
    const content = normalizeLibraryContent(
      {
        ...baseInput,
        buttons: [
          { type: "URL", text: "Shop now", url: "" },
          { type: "QUICK_REPLY", text: "Show me" },
          { type: "QUICK_REPLY", text: "Visit store" },
          { type: "QUICK_REPLY", text: "One too many" },
        ],
      },
      "MARKETING"
    );
    expect(content.buttons).toHaveLength(3);
    expect(content.buttons[0]).toEqual({
      type: "URL",
      text: "Shop now",
      url: "https://example.com",
    });
  });

  it("drops buttons with empty text", () => {
    const content = normalizeLibraryContent(
      { ...baseInput, buttons: [{ type: "QUICK_REPLY", text: "   " }] },
      "MARKETING"
    );
    expect(content.buttons).toHaveLength(0);
  });

  it("rejects an empty body", () => {
    expect(() =>
      normalizeLibraryContent({ ...baseInput, body: "  " }, "MARKETING")
    ).toThrow(/body/i);
  });

  it("rejects a text header without text", () => {
    expect(() =>
      normalizeLibraryContent({ ...baseInput, headerText: "" }, "MARKETING")
    ).toThrow(/header/i);
  });

  it("rejects an image header without a public URL", () => {
    expect(() =>
      normalizeLibraryContent(
        { ...baseInput, headerType: "image", headerImageUrl: "not-a-url" },
        "MARKETING"
      )
    ).toThrow(/image url/i);
  });

  it("requires a template name", () => {
    expect(() =>
      normalizeLibraryContent({ ...baseInput, displayName: " " }, "MARKETING")
    ).toThrow(/name/i);
  });
});

describe("buildLibraryComponents (Meta components shape)", () => {
  it("builds a TEXT header component for text headers", () => {
    const content = normalizeLibraryContent(baseInput, "MARKETING");
    const result = buildLibraryComponents(content, {
      name: "diwali_offer_en",
      language: "en",
      category: "MARKETING",
    });
    expect(result.name).toBe("diwali_offer_en");
    expect(result.language).toBe("en");
    expect(result.components[0]).toEqual({
      type: "HEADER",
      format: "TEXT",
      text: "Diwali sale is live 🪔",
    });
  });

  it("omits the HEADER component when headerType is none", () => {
    const content = normalizeLibraryContent(
      { ...baseInput, headerType: "none", headerText: "" },
      "MARKETING"
    );
    const result = buildLibraryComponents(content, {
      name: "diwali_offer_en",
      language: "en",
      category: "MARKETING",
    });
    expect(result.components.some((c) => c.type === "HEADER")).toBe(false);
    expect(result.components.some((c) => c.type === "BODY")).toBe(true);
  });

  it("uses an IMAGE header and folds the name into the body for image headers", () => {
    const content = normalizeLibraryContent(
      {
        ...baseInput,
        headerType: "image",
        headerText: "",
        headerImageUrl: "https://cdn.example.com/saree.jpg",
      },
      "MARKETING"
    );
    const result = buildLibraryComponents(content, {
      name: "diwali_offer_en",
      language: "en",
      category: "MARKETING",
    });
    const header = result.components.find((c) => c.type === "HEADER");
    expect(header).toEqual({
      type: "HEADER",
      format: "IMAGE",
      example: { header_handle: ["https://cdn.example.com/saree.jpg"] },
    });
    const bodyComponent = result.components.find((c) => c.type === "BODY") as {
      text: string;
    };
    expect(bodyComponent.text.startsWith("*Diwali Offer*")).toBe(true);
  });

  it("omits the FOOTER component when the footer is empty (utility)", () => {
    const content = normalizeLibraryContent(baseInput, "UTILITY");
    const result = buildLibraryComponents(content, {
      name: "order_update_en",
      language: "en",
      category: "UTILITY",
    });
    expect(result.components.some((c) => c.type === "FOOTER")).toBe(false);
    expect(result.category).toBe("UTILITY");
  });

  it("keeps the FOOTER component for marketing (opt-out enforced)", () => {
    const content = normalizeLibraryContent(baseInput, "MARKETING");
    const result = buildLibraryComponents(content, {
      name: "diwali_offer_en",
      language: "en",
      category: "MARKETING",
    });
    expect(result.components).toContainEqual({
      type: "FOOTER",
      text: "Reply STOP to unsubscribe",
    });
  });

  it("maps URL and QUICK_REPLY buttons into a BUTTONS component", () => {
    const content = normalizeLibraryContent(
      {
        ...baseInput,
        buttons: [
          { type: "URL", text: "Shop now", url: "https://shop.example.com" },
          { type: "QUICK_REPLY", text: "Show me" },
        ],
      },
      "MARKETING"
    );
    const result = buildLibraryComponents(content, {
      name: "diwali_offer_en",
      language: "en",
      category: "MARKETING",
    });
    expect(result.components).toContainEqual({
      type: "BUTTONS",
      buttons: [
        { type: "URL", text: "Shop now", url: "https://shop.example.com" },
        { type: "QUICK_REPLY", text: "Show me" },
      ],
    });
  });
});

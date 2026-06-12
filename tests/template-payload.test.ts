import { describe, expect, it } from "vitest";
import {
  buildTemplatePayload,
  slugifyTemplateName,
} from "@/lib/whatsapp/template";
import type { CampaignContent } from "@/lib/campaign/schema";

const content: CampaignContent = {
  productName: "Summer Kurta",
  campaignAngle: "",
  header: "New summer kurtas",
  body: "Hi {{1}}, our new summer kurtas just arrived — 20% off this week only.",
  footer: "Reply STOP to unsubscribe",
  buttons: [
    { type: "URL", text: "Shop now", url: "https://shop.example.com" },
    { type: "QUICK_REPLY", text: "Send catalog" },
  ],
  sampleName: "Priya",
  imageTreatment: "",
  notes: "",
};

describe("buildTemplatePayload (vs docs/WHATSAPP_CLOUD_API.md example)", () => {
  it("builds the image-header payload matching the reference example", () => {
    const payload = buildTemplatePayload(content, {
      name: "summer_kurta_promo",
      headerImageHandle: "<media-handle-from-resumable-upload>",
    });

    expect(payload.name).toBe("summer_kurta_promo");
    expect(payload.language).toBe("en");
    expect(payload.category).toBe("MARKETING");

    expect(payload.components[0]).toEqual({
      type: "HEADER",
      format: "IMAGE",
      example: { header_handle: ["<media-handle-from-resumable-upload>"] },
    });
    // Text header folds into the body as a bold first line.
    expect(payload.components[1]).toEqual({
      type: "BODY",
      text: "*New summer kurtas*\n\nHi {{1}}, our new summer kurtas just arrived — 20% off this week only.",
      example: { body_text: [["Priya"]] },
    });
    expect(payload.components[2]).toEqual({
      type: "FOOTER",
      text: "Reply STOP to unsubscribe",
    });
    expect(payload.components[3]).toEqual({
      type: "BUTTONS",
      buttons: [
        { type: "URL", text: "Shop now", url: "https://shop.example.com" },
        { type: "QUICK_REPLY", text: "Send catalog" },
      ],
    });
  });

  it("uses a TEXT header when there is no image", () => {
    const payload = buildTemplatePayload(content, { name: "no_image_promo" });
    expect(payload.components[0]).toEqual({
      type: "HEADER",
      format: "TEXT",
      text: "New summer kurtas",
    });
    expect(payload.components[1]).toMatchObject({
      type: "BODY",
      text: content.body, // not bold-prefixed
    });
  });

  it("omits the BUTTONS component when there are no buttons", () => {
    const payload = buildTemplatePayload(
      { ...content, buttons: [] },
      { name: "buttonless" }
    );
    expect(payload.components.some((c) => c.type === "BUTTONS")).toBe(false);
  });

  it("category is always MARKETING — never disguised", () => {
    const payload = buildTemplatePayload(content, { name: "x" });
    expect(payload.category).toBe("MARKETING");
  });
});

describe("slugifyTemplateName", () => {
  it("produces meta-safe names", () => {
    expect(slugifyTemplateName("Summer Kurta — 20% Off!", "abc123")).toBe(
      "summer_kurta_20_off_abc123"
    );
  });
  it("handles names with no usable characters", () => {
    expect(slugifyTemplateName("🎉🎉", "xyz")).toBe("campaign_xyz");
  });
});

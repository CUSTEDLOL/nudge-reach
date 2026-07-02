import { describe, expect, it } from "vitest";
import { buildSendPayload } from "@/lib/messaging/drivers/whatsapp-live";

describe("buildSendPayload (Cloud API send shape)", () => {
  it("matches the reference example in docs/WHATSAPP_CLOUD_API.md", () => {
    const payload = buildSendPayload("+919876543210", {
      kind: "template",
      category: "MARKETING",
      templateName: "summer_kurta_promo",
      language: "en",
      bodyParams: ["Priya"],
      headerImageUrl: "https://cdn.example.com/kurta.jpg",
    });

    expect(payload).toEqual({
      messaging_product: "whatsapp",
      to: "+919876543210",
      type: "template",
      template: {
        name: "summer_kurta_promo",
        language: { code: "en" },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "image",
                image: { link: "https://cdn.example.com/kurta.jpg" },
              },
            ],
          },
          {
            type: "body",
            parameters: [{ type: "text", text: "Priya" }],
          },
        ],
      },
    });
  });

  it("omits components entirely when there are no params", () => {
    const payload = buildSendPayload("+919876543210", {
      kind: "template",
      category: "UTILITY",
      templateName: "order_update",
      language: "en",
      bodyParams: [],
    });
    expect(payload.template).not.toHaveProperty("components");
  });

  it("omits the header component when there is no image", () => {
    const payload = buildSendPayload("+919876543210", {
      kind: "template",
      category: "MARKETING",
      templateName: "promo",
      language: "en",
      bodyParams: ["Asha"],
    });
    expect(payload.template).toBeDefined();
    expect(payload.template!.components).toHaveLength(1);
    expect(payload.template!.components?.[0].type).toBe("body");
  });
});

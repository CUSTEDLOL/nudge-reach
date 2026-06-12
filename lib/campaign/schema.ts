import { z } from "zod";

/**
 * The PRD §7 campaign JSON shape. Length caps follow Meta template limits
 * (header/footer 60 chars, body 1024, button text 25).
 */

export const campaignButtonSchema = z.union([
  z.object({
    type: z.literal("URL"),
    text: z.string().min(1).max(25),
    url: z.string().min(1),
  }),
  z.object({
    type: z.literal("QUICK_REPLY"),
    text: z.string().min(1).max(25),
  }),
]);

export const campaignContentSchema = z.object({
  productName: z.string().min(1).max(120),
  campaignAngle: z.string().max(300).default(""),
  header: z.string().min(1).max(60),
  body: z.string().min(1).max(1024),
  footer: z.string().min(1).max(60),
  buttons: z.array(campaignButtonSchema).max(3).default([]),
  sampleName: z.string().min(1).max(40).default("Priya"),
  imageTreatment: z.string().max(300).default(""),
  notes: z.string().max(300).default(""),
});

export type CampaignButton = z.infer<typeof campaignButtonSchema>;
export type CampaignContent = z.infer<typeof campaignContentSchema>;

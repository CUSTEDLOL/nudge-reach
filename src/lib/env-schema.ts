import { z } from "zod";
import { assertRuntimeModelAllowed } from "@/lib/model-router/guard";

/**
 * Environment schema. Kept separate from lib/env.ts (which parses
 * process.env at boot) so it can be unit-tested without real env vars.
 */
export const envSchema = z
  .object({
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),

    // Database
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),

    // Runtime AI — Sonnet is the production tier (founder call 2026-08-29);
    // Haiku stays allowed for cheap paths. Opus/Fable/Mythos throw (guard).
    ANTHROPIC_API_KEY: z.string().optional(),
    RUNTIME_MODEL: z.string().default("claude-sonnet-5"),

    // Messaging
    SEND_MODE: z.enum(["simulation", "live"]).default("simulation"),

    // WhatsApp Cloud API (required only in live mode — see superRefine)
    WHATSAPP_API_VERSION: z.string().default("v23.0"),
    WABA_ID: z.string().optional(),
    PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
    META_APP_SECRET: z.string().optional(),

    // Security
    TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),

    // Pricing config (estimate shown to retailers; verify against Meta)
    WHATSAPP_MARKETING_RATE_INR: z.coerce.number().positive().default(0.99),

    // Voice (ElevenLabs Agents + carrier). All optional: without them every org
    // uses the simulation voice driver. The model ElevenLabs runs is held to
    // the same cheap-tier rule as RUNTIME_MODEL.
    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_AGENT_ID: z.string().optional(),
    ELEVENLABS_WEBHOOK_SECRET: z.string().optional(),
    ELEVENLABS_LLM: z
      .string()
      .default("claude-haiku-4-5")
      .superRefine((model, ctx) => {
        try {
          assertRuntimeModelAllowed(model);
        } catch (e) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message });
        }
      }),
    VOICE_INITIATION_SECRET: z.string().optional(),
    VOICE_TOOLS_SECRET: z.string().optional(),

    // CRM integrations (optional — without keys the simulation provider is used)
    ZOHO_CLIENT_ID: z.string().optional(),
    ZOHO_CLIENT_SECRET: z.string().optional(),
    SALESFORCE_CLIENT_ID: z.string().optional(),
    SALESFORCE_CLIENT_SECRET: z.string().optional(),

    // Payments — Razorpay for INR orgs (optional; free mode without keys)
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

    // Payments — Stripe for USD orgs / global markets (optional)
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // Transactional email — Resend (optional; invites auto-join without it)
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    // "Get Access" lead forwarding — Google Sheets via an Apps Script web-app
    // URL (optional; leads always land in AccessRequest regardless)
    LEADS_SHEET_WEBHOOK_URL: z.string().url().optional(),

    // Google Calendar OAuth (optional). Left empty, "Connect calendar" works in
    // SIMULATION with a mocked calendar — no Google app needed. Fill these only
    // for real OAuth. Deliberately NOT in the live superRefine below: even a
    // live WhatsApp deployment must boot without a calendar.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),

    // Google Places API key (optional) — powers the Google Business Profile
    // knowledge import. Left empty, the import runs in simulation with a
    // demo profile so onboarding demos keyless (invariant #4).
    GOOGLE_MAPS_API_KEY: z.string().optional(),

    // Cron protection (optional): when set, /api/cron/* requires
    // "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends it natively).
    CRON_SECRET: z.string().optional(),

    // Public app origin (invite/email links, absolute URLs). Falls back to the
    // request host when unset.
    NEXT_PUBLIC_APP_URL: z.string().optional(),
  })
  .superRefine((vars, ctx) => {
    if (vars.SEND_MODE === "live") {
      // Only the DEPLOYMENT-level secrets are required to boot live: Meta calls
      // one webhook URL (verify token + app secret) and every per-org token is
      // encrypted with TOKEN_ENCRYPTION_KEY. The SENDER credentials
      // (WABA_ID / PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN) are per-org — each
      // business pastes its own number under Settings → WhatsApp (stored
      // encrypted). The env sender vars remain an optional single-number
      // fallback for a self-host / agency deployment; when unset, an org with
      // no connected number simply can't send until it connects one.
      const requiredLive = [
        "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
        "META_APP_SECRET",
        "TOKEN_ENCRYPTION_KEY",
      ] as const;
      for (const key of requiredLive) {
        if (!vars[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when SEND_MODE=live`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

import { z } from "zod";

const digits = (v: string) => `+${v.replace(/[^\d]/g, "")}`;

const schema = z.object({
  phoneE164: z
    .string()
    .transform(digits)
    .refine((v) => /^\+\d{8,15}$/.test(v), "phone must be 8–15 digits"),
  provider: z.enum(["exotel", "twilio", "sim"], {
    message: "provider must be exotel, twilio or sim",
  }),
  label: z.string().trim().min(1).default("Main line"),
  transferTo: z
    .string()
    .trim()
    .transform((v) => (v ? digits(v) : null))
    .nullable()
    .default(null),
  language: z.enum(["en", "hi"]).default("en"),
  voiceId: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .default(null),
  elevenPhoneId: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .default(null),
});

export type VoiceNumberInput = z.infer<typeof schema>;

export function parseVoiceNumberForm(fd: FormData): VoiceNumberInput {
  const get = (k: string) => (fd.get(k) == null ? undefined : String(fd.get(k)));
  return schema.parse({
    phoneE164: get("phoneE164") ?? "",
    provider: get("provider"),
    label: get("label") || undefined,
    transferTo: get("transferTo") ?? "",
    language: get("language") || undefined,
    voiceId: get("voiceId") ?? "",
    elevenPhoneId: get("elevenPhoneId") ?? "",
  });
}

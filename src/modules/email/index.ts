import { env } from "@/lib/env";

/**
 * Transactional email via Resend's REST API (no SDK dependency). Entirely
 * env-gated: with no RESEND_API_KEY, sendEmail is a no-op that returns
 * { ok:false, skipped:true } — the caller's flow (e.g. team invites) still
 * works via in-app auto-join. Add RESEND_API_KEY + EMAIL_FROM to turn on real
 * delivery.
 */

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      return { ok: false, error: body?.message ?? `Resend HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

/** Absolute app origin for links in emails (env override, else the fallback). */
export function appOrigin(): string {
  return env.NEXT_PUBLIC_APP_URL ?? "https://nudge-reach.vercel.app";
}

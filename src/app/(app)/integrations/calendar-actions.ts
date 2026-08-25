"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { isSimulated } from "@/modules/orgs/mode";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkAiFrontDesk } from "@/modules/billing/limits";
import { recordAudit } from "@/modules/orgs/audit";
import { saveCalendarAccount, disconnectCalendar } from "@/modules/calendar";
import {
  googleAuthUrl,
  isGoogleCalendarConfigured,
} from "@/modules/calendar/google";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Connect the org's Google Calendar. Flagship-gated (AI Front Desk). In
 * simulation it writes a mocked "connected" account so the whole booking +
 * follow-up flow demos with zero Google setup; in live it starts real OAuth.
 */
export async function connectCalendarAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  let authUrl: string | null = null;
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };

    if (isSimulated(ctx.org)) {
      await saveCalendarAccount({
        orgId: ctx.org.id,
        accountEmail: "demo-calendar@nudge.local",
        refreshToken: "sim",
        simulated: true,
      });
      recordAudit(ctx, "calendar.connected", "Google Calendar (simulation)");
      revalidatePath("/integrations");
      return {
        ok: true,
        message:
          'Test mode: calendar "connected" — bookings, reminders and follow-ups are mocked. No Google app needed.',
      };
    }

    if (!isGoogleCalendarConfigured()) {
      return {
        ok: false,
        message:
          "Google Calendar isn't configured yet — add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.",
      };
    }
    // CSRF: an unguessable per-session nonce in `state`, checked in the callback.
    const nonce = randomBytes(16).toString("hex");
    (await cookies()).set("gcal_oauth_state", nonce, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    authUrl = googleAuthUrl(nonce);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't connect the calendar.",
    };
  }
  // redirect() throws NEXT_REDIRECT — keep it OUT of the try so it propagates.
  if (authUrl) redirect(authUrl);
  return { ok: false, message: "Couldn't start the Google connect." };
}

export async function disconnectCalendarAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    await disconnectCalendar(ctx.org.id);
    recordAudit(ctx, "calendar.disconnected", "Google Calendar");
    revalidatePath("/integrations");
    return { ok: true, message: "Calendar disconnected." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't disconnect.",
    };
  }
}

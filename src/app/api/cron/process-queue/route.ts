import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  applySimulatedProgress,
  processQueue,
  releaseDueCampaigns,
} from "@/modules/send/queue";
import { tickAutomationRuns } from "@/modules/automation/engine";
import { tickBookingReminders } from "@/modules/followup/reminders";
import { applySimulatedPaymentProgress } from "@/modules/payments";
import { expireTrials } from "@/modules/billing/trial";

/**
 * Queue tick: releases due SCHEDULED campaigns, resumes WAITING automation
 * runs, then processes a batch for every SENDING campaign. Wire to Vercel
 * Cron in production; the campaign dashboard also ticks on every view, so
 * small sends complete without any cron at all.
 *
 * Every operation here is idempotent and safe to trigger publicly (atomic
 * status claims, unique Message rows), but with CRON_SECRET set the route
 * additionally requires Vercel Cron's bearer header — defense in depth.
 */
export async function GET(request: Request) {
  // With CRON_SECRET set, require Vercel Cron's bearer (timing-safe). Unset →
  // open, which is acceptable here only because every op below is idempotent
  // and consent-gated; production MUST set CRON_SECRET (see GO_LIVE runbook).
  if (env.CRON_SECRET) {
    const got = Buffer.from(request.headers.get("authorization") ?? "");
    const want = Buffer.from(`Bearer ${env.CRON_SECRET}`);
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // 1. Scheduled broadcasts whose time has come → SENDING (spec §M4).
  const released = await releaseDueCampaigns();

  // 2. Automation runs parked on a `wait` step whose resumeAt is due (§M6).
  const resumedRuns = await tickAutomationRuns();

  // 2b. Revenue-Recovery follow-ups: T-24h/T-2h reminders, no-show rebooks,
  //     post-service review asks (5.2). Consent + template-gated like every send.
  const followUps = await tickBookingReminders();

  // 2c. Simulation-mode payment links flip to "paid" after ~90s so the
  //     collect-a-deposit story demos end-to-end with zero keys.
  const paymentsPaid = await applySimulatedPaymentProgress();

  // 2d. AI Front Desk trials that ended fall back to Free.
  const expiredTrials = await expireTrials();

  // 3. Advance every SENDING campaign (including freshly released ones).
  const sending = await prisma.campaign.findMany({
    where: { status: "SENDING" },
    select: { id: true },
  });

  let processed = 0;
  for (const campaign of sending) {
    processed += await processQueue(campaign.id);
    await applySimulatedProgress(campaign.id);
  }
  return NextResponse.json({
    released,
    resumedRuns,
    followUps,
    paymentsPaid,
    expiredTrials,
    campaigns: sending.length,
    processed,
  });
}

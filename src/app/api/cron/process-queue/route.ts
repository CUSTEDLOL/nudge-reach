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
import { tickReminderCalls } from "@/modules/voice/reminder-calls";
import { tickCrmSync } from "@/modules/crm/sync";
import { applySimulatedPaymentProgress } from "@/modules/payments";
import { expireTrials } from "@/modules/billing/trial";
import { tickLeadScoring } from "@/modules/scoring/compute";
import { boundedCount } from "@/modules/admin/health";

const HEARTBEAT_KEY = "process-queue";

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

  let step = "release-campaigns";
  try {
    // 1. Scheduled broadcasts whose time has come → SENDING (spec §M4).
    const released = await releaseDueCampaigns();

    step = "resume-automations";
    const resumedRuns = await tickAutomationRuns();

    step = "sync-crm";
    const crmSynced = await tickCrmSync();

    // Consent + approved-template gates remain inside every follow-up send.
    step = "send-follow-ups";
    const followUps = await tickBookingReminders();

    step = "place-reminder-calls";
    const calls = await tickReminderCalls();

    step = "settle-simulated-payments";
    const paymentsPaid = await applySimulatedPaymentProgress();

    step = "expire-trials";
    const expiredTrials = await expireTrials();

    step = "score-leads";
    const rescored = await tickLeadScoring();

    step = "process-campaigns";
    const sending = await prisma.campaign.findMany({
      where: { status: "SENDING" },
      select: { id: true },
    });
    let processed = 0;
    for (const campaign of sending) {
      processed += await processQueue(campaign.id);
      await applySimulatedProgress(campaign.id);
    }

    const summary = {
      released: boundedCount(released),
      resumedRuns: boundedCount(resumedRuns),
      crm: {
        done: boundedCount(crmSynced.done),
        failed: boundedCount(crmSynced.failed),
        dead: boundedCount(crmSynced.dead),
      },
      followUps: {
        reminders: boundedCount(followUps.reminders),
        reviews: boundedCount(followUps.reviews),
        rebooks: boundedCount(followUps.rebooks),
      },
      calls: {
        reminders: boundedCount(calls.reminders),
        noShows: boundedCount(calls.noShows),
        skipped: boundedCount(calls.skipped),
      },
      paymentsPaid: boundedCount(paymentsPaid),
      expiredTrials: boundedCount(expiredTrials),
      rescored: boundedCount(rescored),
      campaigns: boundedCount(sending.length),
      processed: boundedCount(processed),
    };

    step = "record-heartbeat";
    await prisma.systemHeartbeat.upsert({
      where: { key: HEARTBEAT_KEY },
      create: { key: HEARTBEAT_KEY, status: "ok", detail: summary },
      update: { status: "ok", detail: summary },
    });
    return NextResponse.json(summary);
  } catch {
    // Stable labels only: never persist a provider error, stack, token, payload,
    // contact, or message body in the platform heartbeat.
    try {
      await prisma.systemHeartbeat.upsert({
        where: { key: HEARTBEAT_KEY },
        create: { key: HEARTBEAT_KEY, status: "error", detail: { step } },
        update: { status: "error", detail: { step } },
      });
    } catch {
      // If the database itself is unavailable, the stale heartbeat is the signal.
    }
    return NextResponse.json({ error: "cron_failed", step }, { status: 500 });
  }
}

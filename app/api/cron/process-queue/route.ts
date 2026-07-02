import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  applySimulatedProgress,
  processQueue,
  releaseDueCampaigns,
} from "@/lib/send/queue";
import { tickAutomationRuns } from "@/lib/automation/engine";

/**
 * Queue tick: releases due SCHEDULED campaigns, resumes WAITING automation
 * runs, then processes a batch for every SENDING campaign. Wire to Vercel
 * Cron in production; the campaign dashboard also ticks on every view, so
 * small sends complete without any cron at all.
 */
export async function GET() {
  // 1. Scheduled broadcasts whose time has come → SENDING (spec §M4).
  const released = await releaseDueCampaigns();

  // 2. Automation runs parked on a `wait` step whose resumeAt is due (§M6).
  const resumedRuns = await tickAutomationRuns();

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
    campaigns: sending.length,
    processed,
  });
}

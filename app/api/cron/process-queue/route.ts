import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applySimulatedProgress, processQueue } from "@/lib/send/queue";

/**
 * Queue tick: processes a batch for every SENDING campaign. Wire to Vercel
 * Cron in production; the campaign dashboard also ticks on every view, so
 * small sends complete without any cron at all.
 */
export async function GET() {
  const sending = await prisma.campaign.findMany({
    where: { status: "SENDING" },
    select: { id: true },
  });

  let processed = 0;
  for (const campaign of sending) {
    processed += await processQueue(campaign.id);
    await applySimulatedProgress(campaign.id);
  }
  return NextResponse.json({ campaigns: sending.length, processed });
}

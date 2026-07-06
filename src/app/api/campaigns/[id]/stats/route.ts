import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { callerOrgFilter } from "@/modules/orgs/org";
import {
  applySimulatedProgress,
  campaignStats,
  processQueue,
} from "@/modules/send/queue";

/**
 * Lightweight stats endpoint the campaign dashboard polls instead of doing a
 * full-page router.refresh(). Advances the queue / simulated delivery and
 * returns just the numbers, so the client updates the cards without
 * re-rendering the whole page (no flicker, far less work).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Org-scope without a full org resolution: owner OR member (M1 — was
  // ownerUserId-only, which silently 404'd the live-stats poll for non-owner
  // teammates). Shared helper keeps this identical to the templates route.
  const campaign = await prisma.campaign.findFirst({
    where: { id, org: callerOrgFilter(claims.sub) },
    select: { status: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (campaign.status === "SENDING") {
    await processQueue(id);
  }
  // No-op outside simulation mode (live statuses arrive via webhook).
  await applySimulatedProgress(id);

  const [fresh, stats] = await Promise.all([
    prisma.campaign.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    }),
    campaignStats(id),
  ]);

  return NextResponse.json({ status: fresh.status, stats });
}

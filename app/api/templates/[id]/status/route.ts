import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { refreshLibraryTemplateStatus } from "@/lib/whatsapp/library";

/**
 * Lightweight status endpoint the template library polls (every 4s, stopping
 * once settled) instead of router.refresh() loops — same pattern as
 * /api/campaigns/[id]/stats. Advances the simulated Meta review on each poll.
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

  // Org-scope without a full org resolution: the caller must own the org or
  // hold a membership in it.
  const template = await prisma.template.findFirst({
    where: {
      id,
      campaignId: null,
      org: {
        OR: [
          { ownerUserId: claims.sub },
          { memberships: { some: { userId: claims.sub } } },
        ],
      },
    },
    select: { id: true, orgId: true },
  });
  if (!template?.orgId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const fresh = await refreshLibraryTemplateStatus(template.id, template.orgId);
  if (!fresh) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    status: fresh.metaStatus,
    rejectionReason: fresh.rejectionReason,
    updatedAt: fresh.updatedAt.toISOString(),
  });
}

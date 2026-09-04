import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveApiKeyOrg } from "@/modules/integrations/api-auth";
import { serializeTemplate } from "../serialize";

/** Standalone (non-campaign) templates with their Meta approval status. */
export async function GET(request: Request) {
  const auth = await resolveApiKeyOrg(request);
  if (!auth.ok) return auth.response;
  const rows = await prisma.template.findMany({
    where: { orgId: auth.org.id, campaignId: null },
    orderBy: { submittedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ data: rows.map(serializeTemplate) });
}

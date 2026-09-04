import { NextResponse } from "next/server";
import { resolveApiOrg } from "@/modules/inbox/api-auth";
import { getThreadSnapshot } from "@/modules/inbox/queries";

/**
 * Thread snapshot (messages + status + lastInboundAt) the open conversation
 * polls so new inbound messages appear without a refresh. Org-scoped via
 * verified Supabase claims.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await resolveApiOrg();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snapshot = await getThreadSnapshot(id, auth.orgId, auth.userId);
  if (!snapshot) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}

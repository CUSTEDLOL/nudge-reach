import { NextResponse } from "next/server";
import { resolveApiOrg } from "@/modules/inbox/api-auth";
import { getAttentionCounts } from "@/modules/inbox/queries";

/** Live sidebar counts (unread, needs human, pending bookings), org-scoped. */
export async function GET() {
  const auth = await resolveApiOrg();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getAttentionCounts(auth.orgId, auth.userId));
}

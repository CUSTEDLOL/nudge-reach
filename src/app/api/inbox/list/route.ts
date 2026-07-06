import { NextResponse } from "next/server";
import { resolveApiOrg } from "@/modules/inbox/api-auth";
import { parseInboxFilter } from "@/modules/inbox/filters";
import { listConversationSummaries } from "@/modules/inbox/queries";

/**
 * Conversation summaries the inbox list pane polls (~3s, pausing when the
 * tab is hidden). Org-scoped via verified Supabase claims, same pattern as
 * /api/campaigns/[id]/stats.
 */
export async function GET(request: Request) {
  const auth = await resolveApiOrg();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filter = parseInboxFilter(url.searchParams.get("filter") ?? undefined);
  const q = url.searchParams.get("q") ?? "";

  const conversations = await listConversationSummaries(
    auth.orgId,
    filter,
    q,
    auth.userId
  );
  return NextResponse.json({ conversations });
}

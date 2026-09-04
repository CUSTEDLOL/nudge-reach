import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, resolveApiKeyOrg } from "@/modules/integrations/api-auth";
import { PAGE_SIZE, serializeMessage } from "../../../serialize";

/** Messages in one conversation, oldest first. ?cursor=<id> continues. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveApiKeyOrg(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id, orgId: auth.org.id },
    select: { id: true },
  });
  if (!conversation) return apiError(404, "Conversation not found.");

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const rows = await prisma.conversationMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, PAGE_SIZE);
  return NextResponse.json({
    data: page.map(serializeMessage),
    next_cursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
  });
}

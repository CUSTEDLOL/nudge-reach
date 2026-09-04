import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveApiKeyOrg } from "@/modules/integrations/api-auth";
import { PAGE_SIZE, serializeBooking } from "../serialize";

/** Booking requests, newest first. ?cursor=<id>&status=<status>. */
export async function GET(request: Request) {
  const auth = await resolveApiKeyOrg(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const status = url.searchParams.get("status");
  const rows = await prisma.bookingRequest.findMany({
    where: { orgId: auth.org.id, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, PAGE_SIZE);
  return NextResponse.json({
    data: page.map(serializeBooking),
    next_cursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
  });
}

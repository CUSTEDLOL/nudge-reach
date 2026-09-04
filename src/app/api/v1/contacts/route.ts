import { NextResponse } from "next/server";
import type { LeadStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizePhoneE164 } from "@/lib/phone";
import { apiError, resolveApiKeyOrg } from "@/modules/integrations/api-auth";
import { checkContactLimit } from "@/modules/billing/limits";
import { fireContactCreated } from "@/modules/automation/triggers";
import { recordContactEvent } from "@/modules/contacts/events";
import { LEAD_STAGES, PAGE_SIZE, serializeContact } from "../serialize";

/** List contacts, newest first. Cursor pagination: ?cursor=<id>&stage=<LeadStage>. */
export async function GET(request: Request) {
  const auth = await resolveApiKeyOrg(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const stage = url.searchParams.get("stage");
  const where: Prisma.ContactWhereInput = {
    orgId: auth.org.id,
    ...(stage && LEAD_STAGES.has(stage) ? { leadStage: stage as LeadStage } : {}),
  };

  const rows = await prisma.contact.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, PAGE_SIZE);
  return NextResponse.json({
    data: page.map(serializeContact),
    next_cursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
  });
}

/**
 * Create (or update-by-phone) a contact. Consent rules (invariant 2):
 * opt-in only on CREATE with an explicit opt_in flag; an existing contact's
 * consent fields are NEVER touched — API writes cannot resurrect an opt-out.
 */
export async function POST(request: Request) {
  const auth = await resolveApiKeyOrg(request);
  if (!auth.ok) return auth.response;

  let body: {
    name?: string;
    phone?: string;
    email?: string;
    opt_in?: boolean;
    lead_stage?: string;
  };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Body must be JSON.");
  }

  const name = body.name?.trim();
  const phone = body.phone
    ? normalizePhoneE164(body.phone, auth.org.dialCode)
    : null;
  if (!name || !phone) {
    return apiError(422, "Both name and a valid phone are required.");
  }
  if (body.lead_stage && !LEAD_STAGES.has(body.lead_stage)) {
    return apiError(422, `lead_stage must be one of: ${[...LEAD_STAGES].join(", ")}`);
  }

  const existing = await prisma.contact.findUnique({
    where: { orgId_phoneE164: { orgId: auth.org.id, phoneE164: phone } },
    select: { id: true },
  });
  if (!existing) {
    const limit = await checkContactLimit(auth.org.id, 1);
    if (!limit.allowed) return apiError(403, limit.message);
  }

  const contact = await prisma.contact.upsert({
    where: { orgId_phoneE164: { orgId: auth.org.id, phoneE164: phone } },
    create: {
      orgId: auth.org.id,
      name,
      phoneE164: phone,
      email: body.email ?? null,
      optedIn: body.opt_in === true,
      optInSource: body.opt_in === true ? "api" : "none",
      ...(body.lead_stage ? { leadStage: body.lead_stage as LeadStage } : {}),
    },
    // Existing contact: refresh profile fields only — never consent.
    update: {
      name,
      ...(body.email ? { email: body.email } : {}),
      ...(body.lead_stage ? { leadStage: body.lead_stage as LeadStage } : {}),
    },
  });

  if (!existing) {
    fireContactCreated(auth.org.id, contact.id).catch(() => {});
  } else if (body.lead_stage) {
    recordContactEvent(auth.org.id, "lead_stage_changed", {
      contactId: contact.id,
      props: { to: body.lead_stage, source: "api" },
    });
  }
  return NextResponse.json(
    { data: serializeContact(contact) },
    { status: existing ? 200 : 201 }
  );
}

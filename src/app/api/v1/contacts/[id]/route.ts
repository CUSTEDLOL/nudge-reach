import { NextResponse } from "next/server";
import type { LeadStage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiError, resolveApiKeyOrg } from "@/modules/integrations/api-auth";
import { recordContactEvent } from "@/modules/contacts/events";
import { LEAD_STAGES, serializeContact } from "../../serialize";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveApiKeyOrg(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const contact = await prisma.contact.findFirst({
    where: { id, orgId: auth.org.id },
  });
  if (!contact) return apiError(404, "Contact not found.");
  return NextResponse.json({ data: serializeContact(contact) });
}

/** Update name / email / lead_stage. Consent fields are not writable (invariant 2). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveApiKeyOrg(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: { name?: string; email?: string; lead_stage?: string };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Body must be JSON.");
  }
  if (body.lead_stage && !LEAD_STAGES.has(body.lead_stage)) {
    return apiError(422, `lead_stage must be one of: ${[...LEAD_STAGES].join(", ")}`);
  }
  const data = {
    ...(body.name?.trim() ? { name: body.name.trim() } : {}),
    ...(body.email !== undefined ? { email: body.email || null } : {}),
    ...(body.lead_stage ? { leadStage: body.lead_stage as LeadStage } : {}),
  };
  if (Object.keys(data).length === 0) {
    return apiError(422, "Nothing to update — pass name, email or lead_stage.");
  }

  const updated = await prisma.contact.updateMany({
    where: { id, orgId: auth.org.id },
    data,
  });
  if (updated.count === 0) return apiError(404, "Contact not found.");

  if (body.lead_stage) {
    recordContactEvent(auth.org.id, "lead_stage_changed", {
      contactId: id,
      props: { to: body.lead_stage, source: "api" },
    });
  }
  const contact = await prisma.contact.findFirst({
    where: { id, orgId: auth.org.id },
  });
  return NextResponse.json({ data: contact ? serializeContact(contact) : null });
}

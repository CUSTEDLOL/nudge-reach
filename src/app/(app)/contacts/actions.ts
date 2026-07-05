"use server";

import { revalidatePath } from "next/cache";
import type { LeadStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrg, requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { normalizePhoneE164 } from "@/lib/phone";
import { checkContactLimit } from "@/modules/billing/limits";
import { recordAudit } from "@/modules/orgs/audit";
import { fireContactCreated, fireTagAdded } from "@/modules/automation/triggers";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const LEAD_STAGES = new Set(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]);
const TAG_COLORS = new Set([
  "emerald",
  "sky",
  "amber",
  "red",
  "violet",
  "pink",
  "blue",
  "neutral",
]);

function cleanEmail(raw: string): string | null | undefined {
  const email = raw.trim().toLowerCase();
  if (!email) return null; // explicit clear
  if (!/^\S+@\S+\.\S+$/.test(email)) return undefined; // invalid
  return email;
}

function revalidateContact(id?: string) {
  revalidatePath("/contacts");
  if (id) revalidatePath(`/contacts/${id}`);
}

// ---------------------------------------------------------------------------
// Create + import
// ---------------------------------------------------------------------------

export async function addContact(formData: FormData): Promise<ActionResult> {
  const org = await requireOrg();
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhoneE164(
    String(formData.get("phone") ?? ""),
    org.dialCode
  );
  const optedIn = formData.get("optedIn") === "on";
  const optInSource = String(formData.get("optInSource") ?? "manual");
  const rawEmail = String(formData.get("email") ?? "");
  const email = cleanEmail(rawEmail);
  const stage = String(formData.get("leadStage") ?? "NEW");
  const tagIds = formData.getAll("tagIds").map(String);

  if (!name) return { ok: false, message: "Please enter a name." };
  if (!phone)
    return { ok: false, message: "That phone number doesn't look right." };
  if (rawEmail.trim() && email === undefined)
    return { ok: false, message: "That email doesn't look right." };

  // Plan limit: contacts.
  const limit = await checkContactLimit(org.id, 1);
  if (!limit.allowed) return { ok: false, message: limit.message };

  // Only this org's tags can be attached (scoped lookup, not trusted input).
  const tags =
    tagIds.length > 0
      ? await prisma.tag.findMany({
          where: { id: { in: tagIds }, orgId: org.id },
          select: { id: true, name: true },
        })
      : [];

  let contactId: string;
  try {
    const contact = await prisma.contact.create({
      data: {
        orgId: org.id,
        name,
        phoneE164: phone,
        email: email ?? null,
        optedIn,
        optInSource,
        leadStage: LEAD_STAGES.has(stage) ? (stage as LeadStage) : "NEW",
        tags: { create: tags.map((t) => ({ tagId: t.id })) },
      },
    });
    contactId = contact.id;
  } catch {
    return { ok: false, message: "That number is already in your contacts." };
  }

  // Fire-and-forget: a broken automation never breaks the add.
  fireContactCreated(org.id, contactId).catch(() => {});
  for (const tag of tags) {
    fireTagAdded(org.id, contactId, tag.name).catch(() => {});
  }

  revalidateContact(contactId);
  return { ok: true, message: `${name} added.` };
}

export async function importContactsCsv(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const csv = String(formData.get("csv") ?? "");
  const consentConfirmed = formData.get("consentConfirmed") === "on";

  // Compliance: CSV import must include an explicit opt-in confirmation step.
  if (!consentConfirmed) {
    return {
      ok: false,
      message:
        "Please confirm these customers said yes to WhatsApp messages before importing.",
    };
  }

  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Known phones up front, so we can tell created from updated (for the
  // contact_created automation trigger) without a per-row lookup.
  const existingPhones = new Set(
    (
      await prisma.contact.findMany({
        where: { orgId: org.id },
        select: { phoneE164: true },
      })
    ).map((c) => c.phoneE164)
  );

  // Plan limit: contacts — count only genuinely NEW phones (updates to
  // existing contacts never count against the cap).
  const newPhones = new Set<string>();
  for (const row of rows) {
    const [name, rawPhone] = row.split(",").map((s) => s?.trim() ?? "");
    const phone = rawPhone ? normalizePhoneE164(rawPhone, org.dialCode) : null;
    if (name && phone && !existingPhones.has(phone)) newPhones.add(phone);
  }
  const limit = await checkContactLimit(org.id, newPhones.size);
  if (!limit.allowed) return { ok: false, message: limit.message };

  let imported = 0;
  let skipped = 0;
  const createdIds: string[] = [];
  for (const row of rows) {
    const [name, rawPhone, rawEmail] = row
      .split(",")
      .map((s) => s?.trim() ?? "");
    const phone = rawPhone ? normalizePhoneE164(rawPhone, org.dialCode) : null;
    if (!name || !phone) {
      skipped++;
      continue;
    }
    // Optional third column; a bad email never blocks the row.
    const email = rawEmail ? (cleanEmail(rawEmail) ?? null) : null;
    try {
      const contact = await prisma.contact.upsert({
        where: { orgId_phoneE164: { orgId: org.id, phoneE164: phone } },
        create: {
          orgId: org.id,
          name,
          phoneE164: phone,
          email,
          optedIn: true,
          optInSource: "csv_import",
        },
        // Existing contact: refresh the name; never resurrect an opt-out.
        update: { name, ...(email ? { email } : {}) },
      });
      if (!existingPhones.has(phone)) {
        createdIds.push(contact.id);
        existingPhones.add(phone);
      }
      imported++;
    } catch {
      skipped++;
    }
  }

  for (const id of createdIds) {
    fireContactCreated(org.id, id).catch(() => {});
  }

  revalidatePath("/contacts");
  return {
    ok: imported > 0,
    message: `Imported ${imported} contact${imported === 1 ? "" : "s"}${
      skipped ? `, skipped ${skipped} bad row${skipped === 1 ? "" : "s"}` : ""
    }.`,
  };
}

// ---------------------------------------------------------------------------
// Edit / consent / delete
// ---------------------------------------------------------------------------

/**
 * Partial update — only the fields present in the FormData are touched.
 * Consent fields are deliberately NOT editable here (opt-out is its own,
 * permanent action).
 */
export async function updateContact(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const id = String(formData.get("contactId") ?? "");
  const data: Prisma.ContactUpdateManyMutationInput & {
    assignedToUserId?: string | null;
  } = {};

  if (formData.has("name")) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, message: "Please enter a name." };
    data.name = name;
  }
  if (formData.has("phone")) {
    const phone = normalizePhoneE164(
      String(formData.get("phone") ?? ""),
      org.dialCode
    );
    if (!phone)
      return { ok: false, message: "That phone number doesn't look right." };
    data.phoneE164 = phone;
  }
  if (formData.has("email")) {
    const email = cleanEmail(String(formData.get("email") ?? ""));
    if (email === undefined)
      return { ok: false, message: "That email doesn't look right." };
    data.email = email;
  }
  if (formData.has("leadStage")) {
    const stage = String(formData.get("leadStage") ?? "");
    if (!LEAD_STAGES.has(stage))
      return { ok: false, message: "Pick a valid stage." };
    data.leadStage = stage as LeadStage;
  }
  if (formData.has("assignedToUserId")) {
    const userId = String(formData.get("assignedToUserId") ?? "");
    if (userId) {
      const member = await prisma.membership.findFirst({
        where: { orgId: org.id, userId },
        select: { id: true },
      });
      if (!member) return { ok: false, message: "That teammate wasn't found." };
    }
    data.assignedToUserId = userId || null;
  }

  if (Object.keys(data).length === 0)
    return { ok: false, message: "Nothing to update." };

  try {
    const res = await prisma.contact.updateMany({
      where: { id, orgId: org.id },
      data,
    });
    if (res.count === 0)
      return { ok: false, message: "Contact not found." };
  } catch {
    return { ok: false, message: "That number is already in your contacts." };
  }
  revalidateContact(id);
  return { ok: true, message: "Contact updated." };
}

/** Permanent — rule 2: an opt-out is never resurrected by any code path. */
export async function optOutContact(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const id = String(formData.get("contactId") ?? "");
  const contact = await prisma.contact.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { name: true, phoneE164: true },
  });
  const res = await prisma.contact.updateMany({
    where: { id, orgId: ctx.org.id },
    data: { optedOutAt: new Date(), optedIn: false },
  });
  if (res.count > 0 && contact) {
    recordAudit(ctx, "contact.opted_out", `${contact.name} (${contact.phoneE164})`);
  }
  revalidateContact(id);
  return res.count > 0
    ? { ok: true, message: "Opted out — permanently excluded from campaigns." }
    : { ok: false, message: "Contact not found." };
}

export async function deleteContact(formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const id = String(formData.get("contactId") ?? "");
  const contact = await prisma.contact.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { name: true, phoneE164: true },
  });
  const res = await prisma.contact.deleteMany({
    where: { id, orgId: ctx.org.id },
  });
  if (res.count > 0 && contact) {
    recordAudit(ctx, "contact.deleted", `${contact.name} (${contact.phoneE164})`);
  }
  revalidatePath("/contacts");
  return res.count > 0
    ? { ok: true, message: "Contact deleted." }
    : { ok: false, message: "Contact not found." };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addContactNote(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const contactId = String(formData.get("contactId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, message: "Write a note first." };

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!contact) return { ok: false, message: "Contact not found." };

  await prisma.note.create({
    data: {
      orgId: ctx.org.id,
      contactId: contact.id,
      authorUserId: ctx.userId,
      authorName: ctx.membership.displayName || ctx.email,
      body,
    },
  });
  revalidatePath(`/contacts/${contactId}`);
  return { ok: true, message: "Note added." };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function createTag(formData: FormData): Promise<ActionResult> {
  const org = await requireOrg();
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "emerald");
  if (!name) return { ok: false, message: "Please name the tag." };
  try {
    await prisma.tag.create({
      data: {
        orgId: org.id,
        name,
        color: TAG_COLORS.has(color) ? color : "emerald",
      },
    });
  } catch {
    return { ok: false, message: "A tag with that name already exists." };
  }
  revalidatePath("/contacts");
  return { ok: true, message: `Tag “${name}” created.` };
}

export async function renameTag(formData: FormData): Promise<ActionResult> {
  const org = await requireOrg();
  const id = String(formData.get("tagId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "");
  if (!name) return { ok: false, message: "Please name the tag." };
  try {
    const res = await prisma.tag.updateMany({
      where: { id, orgId: org.id },
      data: { name, ...(TAG_COLORS.has(color) ? { color } : {}) },
    });
    if (res.count === 0) return { ok: false, message: "Tag not found." };
  } catch {
    return { ok: false, message: "A tag with that name already exists." };
  }
  revalidatePath("/contacts");
  return { ok: true, message: "Tag updated." };
}

export async function deleteTag(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext();
    requireRole(ctx, "ADMIN");
    const id = String(formData.get("tagId") ?? "");
    await prisma.tag.deleteMany({ where: { id, orgId: ctx.org.id } });
    revalidatePath("/contacts");
    return { ok: true, message: "Tag deleted." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not delete tag.",
    };
  }
}

export async function addContactTag(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const contactId = String(formData.get("contactId") ?? "");
  const tagId = String(formData.get("tagId") ?? "");

  const [contact, tag] = await Promise.all([
    prisma.contact.findFirst({
      where: { id: contactId, orgId: org.id },
      select: { id: true },
    }),
    prisma.tag.findFirst({
      where: { id: tagId, orgId: org.id },
      select: { id: true, name: true },
    }),
  ]);
  if (!contact || !tag)
    return { ok: false, message: "Contact or tag not found." };

  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
    create: { contactId: contact.id, tagId: tag.id },
    update: {},
  });
  fireTagAdded(org.id, contact.id, tag.name).catch(() => {});
  revalidateContact(contactId);
  return { ok: true, message: `Tagged “${tag.name}”.` };
}

export async function removeContactTag(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const contactId = String(formData.get("contactId") ?? "");
  const tagId = String(formData.get("tagId") ?? "");

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, orgId: org.id },
    select: { id: true },
  });
  if (!contact) return { ok: false, message: "Contact not found." };

  await prisma.contactTag.deleteMany({
    where: { contactId: contact.id, tagId },
  });
  revalidateContact(contactId);
  return { ok: true, message: "Tag removed." };
}

// ---------------------------------------------------------------------------
// Bulk actions (list page row selection)
// ---------------------------------------------------------------------------

async function scopedContactIds(
  orgId: string,
  formData: FormData
): Promise<string[]> {
  const ids = formData.getAll("contactIds").map(String).filter(Boolean);
  if (ids.length === 0) return [];
  const contacts = await prisma.contact.findMany({
    where: { id: { in: ids }, orgId },
    select: { id: true },
  });
  return contacts.map((c) => c.id);
}

export async function bulkAddTag(formData: FormData): Promise<ActionResult> {
  const org = await requireOrg();
  const tagId = String(formData.get("tagId") ?? "");
  const [ids, tag] = await Promise.all([
    scopedContactIds(org.id, formData),
    prisma.tag.findFirst({
      where: { id: tagId, orgId: org.id },
      select: { id: true, name: true },
    }),
  ]);
  if (ids.length === 0) return { ok: false, message: "No contacts selected." };
  if (!tag) return { ok: false, message: "Pick a tag first." };

  await prisma.contactTag.createMany({
    data: ids.map((contactId) => ({ contactId, tagId: tag.id })),
    skipDuplicates: true,
  });
  for (const contactId of ids) {
    fireTagAdded(org.id, contactId, tag.name).catch(() => {});
  }
  revalidatePath("/contacts");
  return {
    ok: true,
    message: `Tagged ${ids.length} contact${ids.length === 1 ? "" : "s"} “${tag.name}”.`,
  };
}

export async function bulkSetStage(formData: FormData): Promise<ActionResult> {
  const org = await requireOrg();
  const stage = String(formData.get("leadStage") ?? "");
  if (!LEAD_STAGES.has(stage))
    return { ok: false, message: "Pick a stage first." };
  const ids = await scopedContactIds(org.id, formData);
  if (ids.length === 0) return { ok: false, message: "No contacts selected." };

  await prisma.contact.updateMany({
    where: { id: { in: ids }, orgId: org.id },
    data: { leadStage: stage as LeadStage },
  });
  revalidatePath("/contacts");
  return {
    ok: true,
    message: `Moved ${ids.length} contact${ids.length === 1 ? "" : "s"} to ${stage.toLowerCase()}.`,
  };
}

export async function bulkAddToAudience(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const audienceId = String(formData.get("audienceId") ?? "");
  const [ids, audience] = await Promise.all([
    scopedContactIds(org.id, formData),
    prisma.audience.findFirst({
      where: { id: audienceId, orgId: org.id },
      select: { id: true, name: true },
    }),
  ]);
  if (ids.length === 0) return { ok: false, message: "No contacts selected." };
  if (!audience) return { ok: false, message: "Pick an audience first." };

  await prisma.audienceContact.createMany({
    data: ids.map((contactId) => ({ audienceId: audience.id, contactId })),
    skipDuplicates: true,
  });
  revalidatePath("/contacts");
  return {
    ok: true,
    message: `Added ${ids.length} contact${ids.length === 1 ? "" : "s"} to “${audience.name}”.`,
  };
}

// ---------------------------------------------------------------------------
// Audiences
// ---------------------------------------------------------------------------

export async function createAudience(
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrg();
  const name = String(formData.get("name") ?? "").trim();
  const contactIds = formData.getAll("contactIds").map(String);

  if (!name) return { ok: false, message: "Please name the audience." };
  if (contactIds.length === 0)
    return { ok: false, message: "Pick at least one contact." };

  // Only this org's contacts can be added (scoped lookup, not trusted input).
  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds }, orgId: org.id },
    select: { id: true },
  });

  await prisma.audience.create({
    data: {
      orgId: org.id,
      name,
      contacts: {
        create: contacts.map((c) => ({ contactId: c.id })),
      },
    },
  });
  revalidatePath("/contacts");
  return { ok: true, message: `Audience “${name}” created.` };
}

export async function deleteAudience(
  formData: FormData
): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext();
    requireRole(ctx, "ADMIN");
    const id = String(formData.get("audienceId") ?? "");
    await prisma.audience.deleteMany({ where: { id, orgId: ctx.org.id } });
    revalidatePath("/contacts");
    return { ok: true, message: "Audience deleted." };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Could not delete audience.",
    };
  }
}

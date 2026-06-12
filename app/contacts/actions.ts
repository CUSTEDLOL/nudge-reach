"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { normalizePhoneE164 } from "@/lib/phone";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function addContact(formData: FormData): Promise<ActionResult> {
  const org = await requireOrg();
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhoneE164(String(formData.get("phone") ?? ""));
  const optedIn = formData.get("optedIn") === "on";
  const optInSource = String(formData.get("optInSource") ?? "manual");

  if (!name) return { ok: false, message: "Please enter a name." };
  if (!phone)
    return { ok: false, message: "That phone number doesn't look right." };

  try {
    await prisma.contact.create({
      data: { orgId: org.id, name, phoneE164: phone, optedIn, optInSource },
    });
  } catch {
    return { ok: false, message: "That number is already in your contacts." };
  }
  revalidatePath("/contacts");
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

  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    const [name, rawPhone] = row.split(",").map((s) => s?.trim() ?? "");
    const phone = rawPhone ? normalizePhoneE164(rawPhone) : null;
    if (!name || !phone) {
      skipped++;
      continue;
    }
    try {
      await prisma.contact.upsert({
        where: { orgId_phoneE164: { orgId: org.id, phoneE164: phone } },
        create: {
          orgId: org.id,
          name,
          phoneE164: phone,
          optedIn: true,
          optInSource: "csv_import",
        },
        // Existing contact: refresh the name; never resurrect an opt-out.
        update: { name },
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/contacts");
  return {
    ok: imported > 0,
    message: `Imported ${imported} contact${imported === 1 ? "" : "s"}${
      skipped ? `, skipped ${skipped} bad row${skipped === 1 ? "" : "s"}` : ""
    }.`,
  };
}

export async function optOutContact(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const id = String(formData.get("contactId") ?? "");
  await prisma.contact.updateMany({
    where: { id, orgId: org.id },
    data: { optedOutAt: new Date(), optedIn: false },
  });
  revalidatePath("/contacts");
}

export async function deleteContact(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const id = String(formData.get("contactId") ?? "");
  await prisma.contact.deleteMany({ where: { id, orgId: org.id } });
  revalidatePath("/contacts");
}

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

export async function deleteAudience(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const id = String(formData.get("audienceId") ?? "");
  await prisma.audience.deleteMany({ where: { id, orgId: org.id } });
  revalidatePath("/contacts");
}

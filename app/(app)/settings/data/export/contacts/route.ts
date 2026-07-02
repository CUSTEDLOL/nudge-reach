import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { canSendMarketing } from "@/lib/consent";

/**
 * Real data export (spec §M8): streams the org's contacts as a CSV download.
 * Auth + org scoping via requireOrg() — same guarantee as every page.
 */

/** RFC-4180 escaping: quote fields containing commas, quotes or newlines. */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const org = await requireOrg();

  const contacts = await prisma.contact.findMany({
    where: { orgId: org.id },
    include: { tags: { include: { tag: true } } },
    orderBy: { createdAt: "asc" },
  });

  const header = [
    "name",
    "phone",
    "email",
    "stage",
    "tags",
    "optedIn",
    "source",
    "createdAt",
  ].join(",");

  const rows = contacts.map((contact) =>
    [
      contact.name,
      contact.phoneE164,
      contact.email ?? "",
      contact.leadStage,
      contact.tags.map(({ tag }) => tag.name).join("|"),
      // Honest consent value: opted in AND never opted out (rule 2).
      canSendMarketing(contact) ? "true" : "false",
      contact.optInSource,
      contact.createdAt.toISOString(),
    ]
      .map(csvField)
      .join(",")
  );

  const csv = [header, ...rows].join("\r\n") + "\r\n";
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nudge-contacts-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

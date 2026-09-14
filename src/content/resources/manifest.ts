export interface ResourceRecord {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  publishedAt: `${number}-${number}-${number}`;
  modifiedAt: `${number}-${number}-${number}`;
  authorName: string;
  parentPath: string;
  draft: boolean;
}

export const RESOURCE_MANIFEST = [
  {
    slug: "whatsapp-appointment-booking-for-clinics",
    title: "WhatsApp Appointment Booking for Clinics: An Operational Guide",
    description:
      "A practical guide to connecting clinic enquiries, real availability, booking confirmation, reminders, deposits and human handoff on WhatsApp.",
    excerpt:
      "Map the complete path from a patient's first message to a confirmed slot without hiding availability, consent or handoff rules.",
    publishedAt: "2026-09-14",
    modifiedAt: "2026-09-14",
    authorName: "Nudge team",
    parentPath: "/industries/clinics",
    draft: false,
  },
] as const satisfies readonly ResourceRecord[];

export type ResourceSlug = (typeof RESOURCE_MANIFEST)[number]["slug"];
export type PublishedResource = Extract<
  (typeof RESOURCE_MANIFEST)[number],
  { draft: false }
>;

export function selectPublishedResources<T extends ResourceRecord>(
  resources: readonly T[],
): Array<T & { draft: false }> {
  return resources.filter(
    (resource): resource is T & { draft: false } => resource.draft === false,
  );
}

export function publishedResources(): PublishedResource[] {
  return selectPublishedResources(RESOURCE_MANIFEST);
}

export function resourceBySlug(slug: string): PublishedResource | undefined {
  return publishedResources().find((resource) => resource.slug === slug);
}

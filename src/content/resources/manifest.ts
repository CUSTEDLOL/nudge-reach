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

const RESOURCE_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

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

export function resourcePath(slug: string): `/resources/${string}` {
  return `/resources/${slug}`;
}

export function resourceRouteParams<T extends ResourceRecord>(
  resources: readonly T[],
) {
  return publishedResourceEntries(resources).map((resource) => ({
    slug: resource.slug,
  }));
}

export function publishedResourceEntries<T extends ResourceRecord>(
  resources: readonly T[],
) {
  return selectPublishedResources(resources).map((resource) => ({
    ...resource,
    href: resourcePath(resource.slug),
  }));
}

export function formatResourceDate(date: ResourceRecord["publishedAt"]): string {
  return RESOURCE_DATE_FORMATTER.format(new Date(`${date}T00:00:00.000Z`));
}

export function publishedResources(): PublishedResource[] {
  return selectPublishedResources(RESOURCE_MANIFEST);
}

export function resourceBySlug(slug: string): PublishedResource | undefined {
  return publishedResources().find((resource) => resource.slug === slug);
}

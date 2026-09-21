export interface ResourceRecord {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  publishedAt: `${number}-${number}-${number}`;
  modifiedAt: `${number}-${number}-${number}`;
  authorName: string;
  parentPath: string;
  audienceLabel: string;
  eyebrow: string;
  ctaTitle: string;
  ctaBody: string;
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
    slug: "how-to-build-whatsapp-ai-automation",
    title: "How to Build WhatsApp AI Automation with the Official Cloud API",
    description:
      "Learn the architecture behind a reliable WhatsApp AI automation: Cloud API webhooks, business knowledge, AI replies, actions, follow-ups and human handoff.",
    excerpt:
      "A practical system map for moving from an inbound WhatsApp message to a grounded reply, business action, compliant follow-up and human handoff.",
    publishedAt: "2026-09-17",
    modifiedAt: "2026-09-17",
    authorName: "Nudge team",
    parentPath: "/whatsapp-ai-automation",
    audienceLabel: "Build guide",
    eyebrow: "WhatsApp AI build guide",
    ctaTitle: "Prefer a working AI Front Desk to a build project?",
    ctaBody:
      "Nudge connects the official WhatsApp Cloud API to your business knowledge, calendars, follow-ups, payments and human team, then helps you set it up.",
    draft: false,
  },
  {
    slug: "how-to-stop-losing-leads-on-whatsapp",
    title: "How to Stop Losing Leads on WhatsApp",
    description:
      "Use a clear WhatsApp lead-response and follow-up workflow so every opted-in enquiry has an owner, status, next action and safe human handoff.",
    excerpt:
      "A five-state operating workflow for answering, qualifying and following up with WhatsApp leads without relying on memory or sending unwanted messages.",
    publishedAt: "2026-09-17",
    modifiedAt: "2026-09-17",
    authorName: "Nudge team",
    parentPath: "/whatsapp-ai-automation",
    audienceLabel: "Lead operations",
    eyebrow: "WhatsApp lead operations",
    ctaTitle: "Give every WhatsApp lead a next action",
    ctaBody:
      "See how Nudge answers from your business knowledge, keeps lead context, follows up with consent and hands important conversations to your team.",
    draft: false,
  },
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
    audienceLabel: "For clinics",
    eyebrow: "Clinic operations guide",
    ctaTitle: "See the complete clinic workflow",
    ctaBody:
      "Walk through real availability, a confirmed booking, compliant follow-up and human handoff in one practical Nudge demo.",
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

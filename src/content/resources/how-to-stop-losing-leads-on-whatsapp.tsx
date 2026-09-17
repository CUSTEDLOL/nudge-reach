import type { ResourceRecord } from "@/content/resources/manifest";

export default function HowToStopLosingLeadsOnWhatsappGuide({
  resource,
}: {
  resource: ResourceRecord;
}) {
  return (
    <article aria-label={resource.title}>
      <p className="text-[1.0625rem] leading-8 text-ink/70">
        This guide gives every opted-in WhatsApp enquiry a clear status, owner,
        next action and safe route to a human when the conversation needs one.
      </p>
    </article>
  );
}

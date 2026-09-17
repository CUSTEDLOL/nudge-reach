import type { ResourceRecord } from "@/content/resources/manifest";

export default function HowToBuildWhatsappAiAutomationGuide({
  resource,
}: {
  resource: ResourceRecord;
}) {
  return (
    <article aria-label={resource.title}>
      <p className="text-[1.0625rem] leading-8 text-ink/70">
        This guide maps the official WhatsApp Cloud API, grounded business
        knowledge, useful actions, compliant follow-up and human handoff into one
        reliable automation workflow.
      </p>
    </article>
  );
}

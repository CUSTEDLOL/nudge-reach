import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/lib/auth";
import {
  parseKeywordConfig,
  STEP_KINDS,
  type AutomationTrigger,
  type StepKind,
} from "@/lib/automation/definitions";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AutomationBuilder } from "../builder";
import { loadBuilderOptions } from "../builder-data";

export const metadata: Metadata = { title: "Edit automation" };

export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org, role } = await requireOrgContext();
  const readOnly = !hasRole(role, "ADMIN");

  const automation = await prisma.automation.findFirst({
    where: { id, orgId: org.id },
    include: {
      steps: { orderBy: { order: "asc" } },
      _count: { select: { runs: true } },
    },
  });
  if (!automation) notFound();

  const options = await loadBuilderOptions(org.id, { includeContacts: true });

  const trigger = (
    ["message_received", "keyword", "contact_created", "tag_added", "campaign_reply"] as const
  ).find((t) => t === automation.trigger) as AutomationTrigger | undefined;
  const keywordConfig = parseKeywordConfig(automation.triggerConfig);
  const triggerConfig =
    automation.triggerConfig &&
    typeof automation.triggerConfig === "object" &&
    !Array.isArray(automation.triggerConfig)
      ? (automation.triggerConfig as Record<string, unknown>)
      : {};

  return (
    <>
      <PageHeader
        title={automation.name}
        description={
          <span className="flex items-center gap-2">
            {automation.description || "Edit the trigger and steps."}
            {readOnly && <Badge tone="neutral">Read-only</Badge>}
          </span>
        }
        actions={
          <>
            <Link
              href="/automations"
              className={buttonVariants({ variant: "secondary" })}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              All automations
            </Link>
            <Link
              href={`/automations/${automation.id}/runs`}
              className={buttonVariants({ variant: "secondary" })}
            >
              <History className="h-4 w-4" aria-hidden />
              Runs ({automation._count.runs})
            </Link>
          </>
        }
      />
      <AutomationBuilder
        options={options}
        readOnly={readOnly}
        initial={{
          id: automation.id,
          name: automation.name,
          description: automation.description,
          enabled: automation.enabled,
          trigger: trigger ?? "message_received",
          keywords: keywordConfig.keywords,
          match: keywordConfig.match,
          preservedTagName:
            automation.trigger === "tag_added" &&
            typeof triggerConfig.tagName === "string"
              ? triggerConfig.tagName
              : undefined,
          steps: automation.steps.map((step) => ({
            kind: (STEP_KINDS.find((k) => k === step.kind) ??
              "send_message") as StepKind,
            config:
              step.config && typeof step.config === "object" && !Array.isArray(step.config)
                ? (step.config as Record<string, unknown>)
                : {},
          })),
        }}
      />
    </>
  );
}

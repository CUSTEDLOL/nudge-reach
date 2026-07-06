import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/modules/orgs/auth";
import { normalizeLogEntries } from "@/modules/automation/definitions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { RunsTable, type RunRow } from "./runs-table";

export const metadata: Metadata = { title: "Automation runs" };

export default async function AutomationRunsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireOrg();

  const automation = await prisma.automation.findFirst({
    where: { id, orgId: org.id },
    include: { _count: { select: { steps: true } } },
  });
  if (!automation) notFound();

  const runs = await prisma.automationRun.findMany({
    where: { automationId: automation.id, orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const contactIds = [
    ...new Set(runs.map((r) => r.contactId).filter((v): v is string => !!v)),
  ];
  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds }, orgId: org.id },
    select: { id: true, name: true, phoneE164: true },
  });
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  const rows: RunRow[] = runs.map((run) => {
    const contact = run.contactId ? contactById.get(run.contactId) : undefined;
    return {
      id: run.id,
      status: run.status,
      contactName: contact?.name ?? "—",
      contactPhone: contact?.phoneE164 ?? "",
      contactId: run.contactId,
      startedAt: run.createdAt.toISOString(),
      resumeAt: run.resumeAt?.toISOString() ?? null,
      stepsCompleted: run.currentStep,
      totalSteps: automation._count.steps,
      log: normalizeLogEntries(run.log),
    };
  });

  return (
    <>
      <PageHeader
        title={`Runs · ${automation.name}`}
        description="Every execution with its per-step log — expand a row for details."
        actions={
          <Link
            href={`/automations/${automation.id}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to automation
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<History className="h-5 w-5" aria-hidden />}
          title="No runs yet"
          description={
            automation.enabled
              ? "This automation hasn't fired yet. Use the test run on the builder page to try it."
              : "This automation is paused — enable it (or use a test run) to see runs here."
          }
          action={
            <Link
              href={`/automations/${automation.id}`}
              className={buttonVariants()}
            >
              Open the builder
            </Link>
          }
        />
      ) : (
        <RunsTable rows={rows} />
      )}
    </>
  );
}

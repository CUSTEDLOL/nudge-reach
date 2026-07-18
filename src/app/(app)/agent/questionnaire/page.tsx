import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { questionnaireScript } from "@/modules/knowledge/questionnaire";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { QuestionnaireClient } from "./questionnaire-client";

export const metadata: Metadata = { title: "Teach your AI" };

export default async function QuestionnairePage() {
  const ctx = await requireOrgContext();
  const canEdit = hasRole(ctx.role, "ADMIN");

  const profile = await prisma.agentProfile.findUnique({
    where: { orgId: ctx.org.id },
    select: { vertical: true },
  });
  const vertical = profile?.vertical ?? ctx.org.vertical ?? "other";
  const script = questionnaireScript(vertical);

  return (
    <section className="mx-auto max-w-2xl">
      <PageHeader
        title="Teach your AI the business"
        description="The more you tell it, the more it answers like your best employee. Skip anything — you can always come back."
      />
      {canEdit ? (
        <QuestionnaireClient script={script} />
      ) : (
        <EmptyState
          title="Ask an admin"
          description="Only owners and admins can teach the AI."
        />
      )}
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/modules/orgs/auth";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AgentForm, type AgentFormValues } from "../agent-form";

export const metadata: Metadata = { title: "Front Desk setup" };

/**
 * The set-once half of the AI Front Desk: who the agent is and how it behaves.
 * Its own page rather than a tab — it was too easy to miss behind one. The
 * recurring work (questions, fact library) lives on /agent.
 */
export default async function AgentSetupPage() {
  const ctx = await requireOrgContext();
  const profile = await prisma.agentProfile.findUnique({
    where: { orgId: ctx.org.id },
  });

  const initial: AgentFormValues = {
    enabled: profile?.enabled ?? false,
    vertical: profile?.vertical ?? "restaurant",
    businessName: profile?.businessName ?? ctx.org.name,
    businessInfo: profile?.businessInfo ?? "",
    tone: profile?.tone ?? "Warm, friendly, and concise",
    doNots: profile?.doNots ?? "",
  };

  return (
    <section>
      <PageHeader
        title="Setup"
        description="Who your AI Front Desk is and how it behaves on WhatsApp. Set this once."
        actions={
          <Link
            href="/agent"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Back to training
          </Link>
        }
      />

      <Card className="p-6">
        <AgentForm initial={initial} />
      </Card>

      <p className="mt-4 text-sm text-neutral-500">
        Test it from the{" "}
        <Link
          href="/inbox"
          className="font-medium text-brand-700 underline-offset-2 hover:underline"
        >
          Inbox
        </Link>{" "}
        — or message it as a customer from{" "}
        <Link
          href="/inbox/try"
          className="font-medium text-brand-700 underline-offset-2 hover:underline"
        >
          Try your AI
        </Link>
        .
      </p>
    </section>
  );
}

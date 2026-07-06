import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/modules/orgs/auth";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "../section-header";
import { AgentForm, type AgentFormValues } from "./agent-form";

export const metadata: Metadata = { title: "AI Agent settings" };

export default async function AgentSettingsPage() {
  const org = await requireOrg();
  const profile = await prisma.agentProfile.findUnique({
    where: { orgId: org.id },
  });

  const initial: AgentFormValues = {
    enabled: profile?.enabled ?? false,
    vertical: profile?.vertical ?? "restaurant",
    businessName: profile?.businessName ?? org.name,
    businessInfo: profile?.businessInfo ?? "",
    tone: profile?.tone ?? "Warm, friendly, and concise",
    doNots: profile?.doNots ?? "",
  };

  return (
    <section>
      <SectionHeader
        title="AI Agent"
        description="How the assistant replies to customers who message you on WhatsApp. It only answers questions about your business — never anything else."
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
        — in simulation mode you can send an inbound message as the customer.
      </p>
    </section>
  );
}

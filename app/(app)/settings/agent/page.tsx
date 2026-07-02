import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { AgentForm, type AgentFormValues } from "./agent-form";

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
    <div className="max-w-xl">
      <PageHeader
        title="WhatsApp assistant"
        description="Set up how your AI assistant replies to customers who message you. It only answers questions about your business — never anything else."
      />

      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
        <AgentForm initial={initial} />
      </div>

      <p className="mt-4 text-center text-sm text-neutral-500">
        Test it on the{" "}
        <Link href="/conversations" className="text-brand-700 underline">
          Conversations
        </Link>{" "}
        page.
      </p>
    </div>
  );
}

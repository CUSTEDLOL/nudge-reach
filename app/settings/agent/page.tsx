import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { AgentForm, type AgentFormValues } from "@/app/settings/agent/agent-form";

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
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-sm text-neutral-500">
          <Link href="/dashboard" className="hover:underline">
            ← Dashboard
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900">
          WhatsApp assistant
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Set up how your AI assistant replies to customers who message you.
          It only answers questions about your business — never anything else.
        </p>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <AgentForm initial={initial} />
        </div>

        <p className="mt-4 text-center text-sm text-neutral-500">
          Test it on the{" "}
          <Link href="/conversations" className="text-emerald-700 underline">
            Conversations
          </Link>{" "}
          page.
        </p>
      </div>
    </main>
  );
}

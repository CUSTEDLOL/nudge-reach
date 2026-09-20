import type { Metadata } from "next";
import { isSimulated } from "@/modules/orgs/mode";
import { requireOrgContext } from "@/modules/orgs/auth";
import { getWhatsappAccount } from "@/modules/whatsapp/accounts";
import { prisma } from "@/lib/db";
import { hasRole } from "@/modules/orgs/auth";
import { PageHeader } from "@/components/ui/page-header";
import { AiOffNotice } from "@/components/features/front-desk/ai-off-notice";
import { getTrialWorkspace } from "@/modules/trial/workspace";
import { trialTestIdentity } from "@/modules/trial/test-inbox";
import { getTrialTestMessages } from "@/modules/trial/test-inbox-query";
import { TryYourAi } from "./try-your-ai";

export const metadata: Metadata = { title: "Try your AI" };

export default async function TryYourAiPage() {
  const ctx = await requireOrgContext();
  const { org } = ctx;
  const [account, profile, trialWorkspace] = await Promise.all([
    getWhatsappAccount(org.id),
    prisma.agentProfile.findUnique({ where: { orgId: org.id }, select: { enabled: true } }),
    getTrialWorkspace(org.id),
  ]);
  const trial = trialWorkspace && !trialWorkspace.converted
    ? trialWorkspace
    : null;
  const testIdentity = trial ? trialTestIdentity() : null;
  const initialMessages = trial ? await getTrialTestMessages(org.id) : [];

  return (
    <>
      <PageHeader
        title={trial ? "Test Inbox" : "Try your AI"}
        description={trial
          ? "Ask a patient question and watch your AI Front Desk answer from the facts you approved."
          : "Message your business the way a customer would. The reply comes from your AI Front Desk, using only what you've taught it."}
      />
      {profile && !profile.enabled && (
        <div className="mb-4">
          <AiOffNotice canEdit={hasRole(ctx.role, "ADMIN")} />
        </div>
      )}
      <TryYourAi
        simulation={isSimulated(org)}
        dialCode={org.dialCode}
        connectedName={account?.displayName ?? null}
        trial={trial}
        testIdentity={testIdentity}
        initialMessages={initialMessages}
      />
    </>
  );
}

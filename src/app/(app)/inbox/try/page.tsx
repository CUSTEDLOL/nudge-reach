import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSimulated } from "@/modules/orgs/mode";
import { requireOrgContext } from "@/modules/orgs/auth";
import { getWhatsappAccount } from "@/modules/whatsapp/accounts";
import { prisma } from "@/lib/db";
import { hasRole } from "@/modules/orgs/auth";
import { PageHeader } from "@/components/ui/page-header";
import { AiOffNotice } from "@/components/features/front-desk/ai-off-notice";
import { TryYourAi } from "@/components/features/trial/try-your-ai";
import { getTrialWorkspace } from "@/modules/trial/workspace";

export const metadata: Metadata = { title: "Try your AI" };

export default async function TryYourAiPage() {
  const ctx = await requireOrgContext();
  const { org } = ctx;
  const trialWorkspace = await getTrialWorkspace(org.id);
  if (trialWorkspace && !trialWorkspace.converted) redirect("/dashboard");

  const [account, profile] = await Promise.all([
    getWhatsappAccount(org.id),
    prisma.agentProfile.findUnique({ where: { orgId: org.id }, select: { enabled: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Try your AI"
        description="Message your business the way a customer would. The reply comes from your AI Front Desk, using only what you've taught it."
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
        trial={null}
        testIdentity={null}
      />
    </>
  );
}

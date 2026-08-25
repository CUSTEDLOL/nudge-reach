import type { Metadata } from "next";
import { env } from "@/lib/env";
import { requireOrgContext } from "@/modules/orgs/auth";
import { getWhatsappAccount } from "@/modules/whatsapp/accounts";
import { PageHeader } from "@/components/ui/page-header";
import { TryYourAi } from "./try-your-ai";

export const metadata: Metadata = { title: "Try your AI" };

export default async function TryYourAiPage() {
  const { org } = await requireOrgContext();
  const account = await getWhatsappAccount(org.id);
  return (
    <>
      <PageHeader
        title="Try your AI"
        description="Message your business the way a customer would. The reply comes from your AI Front Desk, using only what you've taught it."
      />
      <TryYourAi
        simulation={env.SEND_MODE === "simulation"}
        dialCode={org.dialCode}
        connectedName={account?.displayName ?? null}
      />
    </>
  );
}

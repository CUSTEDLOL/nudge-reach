import type { Metadata } from "next";
import { Blocks } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrations"
        description="WhatsApp Cloud API connection, API keys and third-party hooks."
      />
      <EmptyState
        icon={<Blocks className="h-5 w-5" aria-hidden />}
        title="This module is being assembled"
        description="Connection status, webhook setup and API keys land here shortly."
      />
    </>
  );
}

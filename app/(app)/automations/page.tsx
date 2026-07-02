import type { Metadata } from "next";
import { Workflow } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Automations" };

export default function AutomationsPage() {
  return (
    <>
      <PageHeader
        title="Automations"
        description="Trigger-based flows: welcome messages, keyword replies and follow-ups."
      />
      <EmptyState
        icon={<Workflow className="h-5 w-5" aria-hidden />}
        title="This module is being assembled"
        description="The automation builder — triggers, steps and run logs — lands here shortly."
      />
    </>
  );
}

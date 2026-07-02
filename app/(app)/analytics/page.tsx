import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Message volume, campaign performance, agent stats and your lead funnel."
      />
      <EmptyState
        icon={<BarChart3 className="h-5 w-5" aria-hidden />}
        title="This module is being assembled"
        description="Charts and reports computed from your real workspace data land here shortly."
      />
    </>
  );
}

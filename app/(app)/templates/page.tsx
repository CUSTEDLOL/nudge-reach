import type { Metadata } from "next";
import { LayoutTemplate } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  return (
    <>
      <PageHeader
        title="Templates"
        description="Reusable, Meta-approved message templates for campaigns and replies."
      />
      <EmptyState
        icon={<LayoutTemplate className="h-5 w-5" aria-hidden />}
        title="This module is being assembled"
        description="The template library — create, submit for approval and reuse — lands here shortly."
      />
    </>
  );
}

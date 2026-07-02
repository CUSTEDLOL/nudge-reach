import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <>
      <PageHeader
        title="Inbox"
        description="Every WhatsApp conversation in one shared team inbox."
      />
      <EmptyState
        icon={<MessageSquare className="h-5 w-5" aria-hidden />}
        title="This module is being assembled"
        description="The shared inbox — threads, assignments and AI-suggested replies — lands here shortly."
      />
    </>
  );
}

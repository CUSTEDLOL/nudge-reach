import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { headers } from "next/headers";
import { requireOrgContext } from "@/modules/orgs/auth";
import { checkWebWidget } from "@/modules/billing/limits";
import { getWidgetConfig } from "@/modules/widget";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "../section-header";
import { WidgetForm } from "./widget-form";

export const metadata: Metadata = { title: "Website widget" };

export default async function WidgetSettingsPage() {
  const ctx = await requireOrgContext();
  const gate = await checkWebWidget(ctx.org.id);

  if (ctx.role === "AGENT" || !gate.allowed) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Website widget"
          description="A WhatsApp button for your own website."
        />
        <EmptyState
          icon={<Lock className="h-5 w-5" aria-hidden />}
          title={ctx.role === "AGENT" ? "Managed by admins" : "A paid-plan feature"}
          description={
            ctx.role === "AGENT"
              ? "Ask a workspace admin or the owner to configure the widget."
              : gate.message
          }
        />
      </section>
    );
  }

  const [config, headerList] = await Promise.all([
    getWidgetConfig(ctx.org.id),
    headers(),
  ]);
  const host = headerList.get("host") ?? "nudgeagent.app";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Website widget"
        description="A floating WhatsApp button for your website — visitors tap it and land straight in a chat with your number (and your AI)."
      />
      <WidgetForm initial={config!} appOrigin={`${proto}://${host}`} />
    </section>
  );
}

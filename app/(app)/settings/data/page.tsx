import type { Metadata } from "next";
import { Download, FileDown, MessageSquare } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "../section-header";

export const metadata: Metadata = { title: "Data settings" };

export default async function DataSettingsPage() {
  const { org } = await requireOrgContext();
  const [contactCount, conversationMessages, campaignMessages] =
    await Promise.all([
      prisma.contact.count({ where: { orgId: org.id } }),
      prisma.conversationMessage.count({
        where: { conversation: { orgId: org.id } },
      }),
      prisma.message.count({ where: { campaign: { orgId: org.id } } }),
    ]);
  const messageCount = conversationMessages + campaignMessages;

  return (
    <section>
      <SectionHeader
        title="Data"
        description="Your data is yours — export it any time."
      />
      <div className="flex flex-col gap-4">
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <FileDown className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                Export contacts
              </p>
              <p className="mt-0.5 text-sm text-neutral-500">
                Download all {contactCount.toLocaleString("en-IN")} contact
                {contactCount === 1 ? "" : "s"} as CSV — name, phone, email,
                stage, tags, opt-in status, source and created date.
              </p>
            </div>
          </div>
          <a
            href="/settings/data/export/contacts"
            className={buttonVariants({ variant: "secondary" })}
            download
          >
            <Download className="h-4 w-4" aria-hidden />
            Download CSV
          </a>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <MessageSquare className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                Export message history
              </p>
              <p className="mt-0.5 text-sm text-neutral-500">
                All {messageCount.toLocaleString("en-IN")} conversation and
                campaign message
                {messageCount === 1 ? "" : "s"} as CSV — direction, contact,
                body, campaign, delivery status and timestamps.
              </p>
            </div>
          </div>
          <a
            href="/settings/data/export/messages"
            className={buttonVariants({ variant: "secondary" })}
            download
          >
            <Download className="h-4 w-4" aria-hidden />
            Download CSV
          </a>
        </Card>
      </div>
    </section>
  );
}

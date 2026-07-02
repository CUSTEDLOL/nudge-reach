import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/lib/auth";
import {
  libraryTemplateContentSchema,
  type LibraryTemplateContent,
} from "@/lib/whatsapp/library";
import { PageHeader } from "@/components/ui/page-header";
import { TemplateForm } from "../template-form";
import { StatusBanner } from "./status-banner";

export const metadata: Metadata = { title: "Edit template" };

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const canManage = hasRole(ctx.role, "ADMIN");

  const template = await prisma.template.findFirst({
    where: { id, orgId: ctx.org.id, campaignId: null },
  });
  if (!template) notFound();

  // Legacy rows without editable content still open with sensible defaults.
  const parsed = libraryTemplateContentSchema.safeParse(template.content);
  const content: LibraryTemplateContent = parsed.success
    ? parsed.data
    : libraryTemplateContentSchema.parse({
        productName: template.name,
        body: "Hi {{1}}, ",
        headerType: "none",
      });

  return (
    <>
      <PageHeader
        title={content.productName}
        description={
          <span className="flex items-center gap-2">
            <Link
              href="/templates"
              className="inline-flex items-center gap-1 text-brand-700 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Templates
            </Link>
            <span aria-hidden>·</span>
            <span className="font-mono text-xs">{template.name}</span>
          </span>
        }
      />
      <StatusBanner
        templateId={template.id}
        status={template.metaStatus}
        rejectionReason={template.rejectionReason}
        canManage={canManage}
      />
      <TemplateForm
        template={{
          id: template.id,
          status: template.metaStatus,
          category: template.category,
          language: template.language,
          content,
        }}
        readOnly={!canManage}
      />
    </>
  );
}

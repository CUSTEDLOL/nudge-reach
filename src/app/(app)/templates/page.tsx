import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { libraryTemplateContentSchema } from "@/modules/whatsapp/library";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { TemplatesList, type TemplateListRow } from "./templates-list";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const ctx = await requireOrgContext();
  const canManage = hasRole(ctx.role, "ADMIN");

  const rows = await prisma.template.findMany({
    where: { orgId: ctx.org.id, campaignId: null },
    orderBy: { updatedAt: "desc" },
  });

  const templates: TemplateListRow[] = rows.map((t) => {
    const parsed = libraryTemplateContentSchema.safeParse(t.content);
    return {
      id: t.id,
      name: t.name,
      displayName: parsed.success ? parsed.data.productName : t.name,
      bodyPreview: parsed.success ? parsed.data.body : "",
      category: t.category,
      language: t.language,
      status: t.metaStatus,
      rejectionReason: t.rejectionReason,
      updatedAt: t.updatedAt.toISOString(),
    };
  });

  return (
    <>
      <PageHeader
        title="Templates"
        description="Reusable, Meta-approved message templates for campaigns and inbox replies."
        actions={
          canManage ? (
            <Link href="/templates/new" className={buttonVariants()}>
              <Plus className="h-4 w-4" aria-hidden />
              New template
            </Link>
          ) : undefined
        }
      />
      <TemplatesList templates={templates} canManage={canManage} />
    </>
  );
}

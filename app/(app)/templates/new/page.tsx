import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasRole, requireOrgContext } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { TemplateForm } from "../template-form";

export const metadata: Metadata = { title: "New template" };

export default async function NewTemplatePage() {
  const ctx = await requireOrgContext();
  // Agents are read-only in the template library.
  if (!hasRole(ctx.role, "ADMIN")) redirect("/templates");

  return (
    <>
      <PageHeader
        title="New template"
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
            <span>Write once, reuse in every campaign and reply.</span>
          </span>
        }
      />
      <TemplateForm template={null} />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasRole, requireOrgContext } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { AutomationBuilder } from "../builder";
import { loadBuilderOptions } from "../builder-data";

export const metadata: Metadata = { title: "New automation" };

export default async function NewAutomationPage() {
  const { org, role } = await requireOrgContext();
  // Agents are read-only on automations (spec §M6) — nothing to build here.
  if (!hasRole(role, "ADMIN")) redirect("/automations");

  const options = await loadBuilderOptions(org.id);

  return (
    <>
      <PageHeader
        title="New automation"
        description="Pick a trigger, add steps, save — it runs on autopilot."
        actions={
          <Link
            href="/automations"
            className={buttonVariants({ variant: "secondary" })}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All automations
          </Link>
        }
      />
      <AutomationBuilder
        options={options}
        initial={{
          name: "",
          description: "",
          enabled: false,
          trigger: "message_received",
          keywords: [],
          match: "contains",
          steps: [],
        }}
      />
    </>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireFounder } from "@/modules/admin/auth";
import { orgHeader } from "@/modules/admin/org-detail";
import { trialDaysLeft } from "@/modules/billing/trial";
import { getPlan } from "@/modules/billing/plans";
import { Badge } from "@/components/ui/badge";
import { OrgTabs } from "@/components/features/admin-shell/org-tabs";

/** One organisation: identity strip + tabs. Each tab page re-runs the gate. */
export default async function AdminOrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireFounder();
  const { id } = await params;
  const org = await orgHeader(id);
  if (!org) notFound();

  const trialLeft = trialDaysLeft(org.trialEndsAt);
  const owner = org.memberships[0]?.email;

  return (
    <div>
      <Link
        href="/admin/orgs"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All organisations
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        {org.suspendedAt && <Badge tone="danger">Suspended</Badge>}
        <Badge tone={org.simulated ? "warning" : "success"}>
          {org.simulated ? "Test mode" : "Live"}
        </Badge>
        <Badge tone="brand">{getPlan(org.plan).name}</Badge>
        {trialLeft !== null && (
          <Badge tone={trialLeft <= 3 ? "warning" : "info"}>
            {trialLeft === 0 ? "Trial ended" : `Trial · ${trialLeft}d left`}
          </Badge>
        )}
        {org.subscriptionStatus !== "inactive" && (
          <Badge
            tone={
              org.subscriptionStatus === "active"
                ? "success"
                : org.subscriptionStatus === "past_due"
                  ? "danger"
                  : "neutral"
            }
          >
            Subscription {org.subscriptionStatus.replace("_", " ")}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        {owner || "no owner email on record"} · {org.vertical ?? "no vertical"} · {org.currency} ·
        joined {org.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        <span className="ml-2 select-all font-mono text-xs text-neutral-400">{org.id}</span>
      </p>

      <div className="mt-5">
        <OrgTabs orgId={org.id} />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

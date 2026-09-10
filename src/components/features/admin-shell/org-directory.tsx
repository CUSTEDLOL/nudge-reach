import Link from "next/link";
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { formatMicroUsd } from "@/modules/analytics/compute";
import { getPlan } from "@/modules/billing/plans";
import { trialDaysLeft } from "@/modules/billing/trial";
import type { OrgRow, OrgSort } from "@/modules/admin/queries";

const READINESS: Record<OrgRow["readiness"], { label: string; tone: BadgeTone }> = {
  ready: { label: "Ready", tone: "success" },
  blocked: { label: "Setup blocked", tone: "warning" },
  degraded: { label: "Needs attention", tone: "danger" },
};

const date = (value: Date | null) => value?.toLocaleDateString("en-GB") ?? "—";

function Readiness({ org }: { org: OrgRow }) {
  const state = READINESS[org.readiness];
  return (
    <div>
      <Badge tone={state.tone}>{state.label}</Badge>
      {org.readinessIssues.length > 0 && (
        <p className="mt-1 max-w-52 text-xs leading-4 text-neutral-500" title={org.readinessIssues.join(", ")}>
          {org.readinessIssues[0]}
          {org.readinessIssues.length > 1 && ` +${org.readinessIssues.length - 1}`}
        </p>
      )}
    </div>
  );
}

function WorkspaceState({ org }: { org: OrgRow }) {
  const trialLeft = trialDaysLeft(org.trialEndsAt);
  return (
    <span className="flex flex-wrap gap-1">
      {org.suspended && <Badge tone="danger">Suspended</Badge>}
      <Badge tone={org.simulated ? "warning" : "success"}>{org.simulated ? "Test" : "Live"}</Badge>
      {org.subscriptionStatus === "active" && <Badge tone="success">Paying</Badge>}
      {org.subscriptionStatus === "past_due" && <Badge tone="danger">Past due</Badge>}
      {org.subscriptionStatus === "cancelled" && <Badge tone="neutral">Cancelled</Badge>}
      {trialLeft !== null && org.subscriptionStatus !== "active" && (
        <Badge tone={trialLeft <= 3 ? "warning" : "info"}>
          {trialLeft === 0 ? "Trial ended" : `Trial ${trialLeft}d`}
        </Badge>
      )}
    </span>
  );
}

function hrefWith(baseParams: Record<string, string>, extra: Record<string, string>) {
  const params = new URLSearchParams({ ...baseParams, ...extra });
  for (const [key, value] of [...params.entries()]) {
    if (!value || (key === "page" && value === "1")) params.delete(key);
  }
  const query = params.toString();
  return query ? `/admin/orgs?${query}` : "/admin/orgs";
}

function SortHeading({
  label,
  value,
  sort,
  baseParams,
  align = "left",
}: {
  label: string;
  value: OrgSort;
  sort: OrgSort;
  baseParams: Record<string, string>;
  align?: "left" | "right";
}) {
  const active = sort === value;
  return (
    <th
      scope="col"
      aria-sort={active ? (value === "name" || value === "trial_end" ? "ascending" : "descending") : "none"}
      className={`px-3 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <Link
        href={hrefWith(baseParams, { sort: value, page: "1" })}
        className="inline-flex min-h-11 items-center gap-1 hover:text-neutral-900"
      >
        {label}
        {active && <ArrowDown className="h-3 w-3" aria-hidden />}
      </Link>
    </th>
  );
}

export function OrgDirectory({
  rows,
  page,
  pageCount,
  total,
  sort,
  baseParams,
}: {
  rows: OrgRow[];
  page: number;
  pageCount: number;
  total: number;
  sort: OrgSort;
  baseParams: Record<string, string>;
}) {
  return (
    <section className="mt-5" aria-label="Organization directory">
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50/70 text-xs text-neutral-500">
            <tr>
              <SortHeading label="Organisation" value="name" sort={sort} baseParams={baseParams} />
              <th scope="col" className="px-3 py-3 text-left font-medium">Readiness</th>
              <th scope="col" className="px-3 py-3 text-left font-medium">Plan & status</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Workspace</th>
              <SortHeading label="Last inbound" value="last_activity" sort={sort} baseParams={baseParams} />
              <SortHeading label="AI cost · 30d" value="cost" sort={sort} baseParams={baseParams} align="right" />
              <SortHeading label="Joined" value="newest" sort={sort} baseParams={baseParams} />
              <th scope="col"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((org) => (
              <tr key={org.id} className="group hover:bg-neutral-50/80">
                <td className="px-3 py-3">
                  <Link href={`/admin/orgs/${org.id}`} className="font-medium text-neutral-900 hover:underline">
                    {org.name}
                  </Link>
                  <p className="mt-0.5 max-w-64 truncate text-xs text-neutral-500" title={org.ownerEmail ?? undefined}>
                    {org.ownerEmail ?? "No owner email"}{org.vertical && ` · ${org.vertical}`}
                  </p>
                </td>
                <td className="px-3 py-3"><Readiness org={org} /></td>
                <td className="px-3 py-3">
                  <p className="mb-1.5 font-medium text-neutral-700">{getPlan(org.plan).name}</p>
                  <WorkspaceState org={org} />
                </td>
                <td className="px-3 py-3 text-right text-xs text-neutral-600">
                  <p><span className="tabular-nums text-neutral-900">{org.contacts.toLocaleString()}</span> contacts</p>
                  <p className="mt-1 tabular-nums">{org.numbers} numbers · {org.members} seats</p>
                </td>
                <td className="px-3 py-3 text-xs text-neutral-600">{date(org.lastInboundAt)}</td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-neutral-700">
                  {formatMicroUsd(org.aiCostMicroUsd30d)}
                </td>
                <td className="px-3 py-3 text-xs text-neutral-600">{date(org.createdAt)}</td>
                <td className="px-3 py-3 text-right">
                  <Link href={`/admin/orgs/${org.id}`} aria-label={`Open ${org.name}`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-400 hover:bg-white hover:text-neutral-900">
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-5 py-12 text-center text-sm text-neutral-400">No organisations match these filters.</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white md:hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-neutral-400">No organisations match these filters.</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {rows.map((org) => (
              <li key={org.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/orgs/${org.id}`} className="font-semibold text-neutral-900 hover:underline">{org.name}</Link>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{org.ownerEmail ?? "No owner email"}{org.vertical && ` · ${org.vertical}`}</p>
                  </div>
                  <Link href={`/admin/orgs/${org.id}`} aria-label={`Open ${org.name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600">
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-neutral-100 pt-3">
                  <Readiness org={org} />
                  <div className="text-right">
                    <p className="text-sm font-medium text-neutral-700">{getPlan(org.plan).name}</p>
                    <div className="mt-1"><WorkspaceState org={org} /></div>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div><dt className="text-neutral-400">Workspace</dt><dd className="mt-0.5 text-neutral-700">{org.contacts.toLocaleString()} contacts · {org.numbers} numbers · {org.members} seats</dd></div>
                  <div><dt className="text-neutral-400">AI cost · 30d</dt><dd className="mt-0.5 font-medium tabular-nums text-neutral-700">{formatMicroUsd(org.aiCostMicroUsd30d)}</dd></div>
                  <div><dt className="text-neutral-400">Last inbound</dt><dd className="mt-0.5 text-neutral-700">{date(org.lastInboundAt)}</dd></div>
                  <div><dt className="text-neutral-400">Joined</dt><dd className="mt-0.5 text-neutral-700">{date(org.createdAt)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-neutral-500">{total.toLocaleString()} organisations · Page {page} of {pageCount}</p>
        <nav aria-label="Organization pages" className="flex gap-2">
          {page > 1 ? (
            <Link href={hrefWith(baseParams, { page: String(page - 1) })} className="inline-flex h-11 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 font-medium hover:bg-neutral-50">
              <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
            </Link>
          ) : (
            <span className="inline-flex h-11 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-neutral-400" aria-disabled="true">
              <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
            </span>
          )}
          {page < pageCount ? (
            <Link href={hrefWith(baseParams, { page: String(page + 1) })} className="inline-flex h-11 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 font-medium hover:bg-neutral-50">
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className="inline-flex h-11 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-neutral-400" aria-disabled="true">
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </nav>
      </footer>
    </section>
  );
}

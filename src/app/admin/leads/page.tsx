import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import { LEAD_STATUSES, leadCounts, leadsList, type LeadKind, type LeadStatus } from "@/modules/admin/leads";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadRowItem } from "./lead-row";

const KINDS: { value: LeadKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "access", label: "Access requests" },
  { value: "waitlist", label: "Waitlist" },
];

function pick<T extends string>(raw: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** The sales pipeline the landing page feeds: nobody sees these anywhere else. */
export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; kind?: string | string[] }>;
}) {
  await requireFounder();
  const sp = await searchParams;
  const status = pick<LeadStatus | "all">(sp.status, [...LEAD_STATUSES, "all"], "new");
  const kind = pick<LeadKind | "all">(sp.kind, ["all", "access", "waitlist"], "all");
  const [rows, counts] = await Promise.all([leadsList({ status, kind }), leadCounts()]);

  const href = (s: string, k: string) => `/admin/leads?status=${s}&kind=${k}`;
  const pill = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm ${active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`;

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Access requests and waitlist signups from the landing page. Move each one along; the badge in the sidebar counts what's still new."
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <nav aria-label="Status" className="flex flex-wrap gap-1">
          {[...LEAD_STATUSES, "all" as const].map((s) => (
            <Link key={s} href={href(s, kind)} className={pill(s === status)}>
              <span className="capitalize">{s}</span>
              <span className="ml-1.5 text-xs opacity-70 tabular-nums">
                {s === "all" ? counts.total : counts.byStatus[s]}
              </span>
            </Link>
          ))}
        </nav>
        <span className="mx-1 hidden h-5 w-px bg-neutral-200 sm:block" />
        <nav aria-label="Source" className="flex flex-wrap gap-1">
          {KINDS.map((k) => (
            <Link key={k.value} href={href(status, k.value)} className={pill(k.value === kind)}>
              {k.label}
            </Link>
          ))}
        </nav>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              title={status === "new" ? "Inbox zero" : "Nothing here"}
              description={
                status === "new"
                  ? "Every lead has been touched. New ones appear as the landing page collects them."
                  : "No leads match this filter."
              }
              className="py-12"
            />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {rows.map((lead) => (
                <LeadRowItem key={`${lead.kind}-${lead.id}`} lead={lead} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

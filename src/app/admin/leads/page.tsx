import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
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
  searchParams: Promise<{
    status?: string | string[];
    kind?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  await requireFounder();
  const sp = await searchParams;
  const status = pick<LeadStatus | "all">(sp.status, [...LEAD_STATUSES, "all"], "new");
  const kind = pick<LeadKind | "all">(sp.kind, ["all", "access", "waitlist"], "all");
  const rawQuery = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = rawQuery?.trim() ?? "";
  const rawPage = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isFinite(rawPage) ? rawPage : 1;
  const [result, counts] = await Promise.all([leadsList({ status, kind, search: q, page }), leadCounts()]);

  const href = (extra: Record<string, string>) => {
    const params = new URLSearchParams({ status, kind, ...(q ? { q } : {}), ...extra });
    params.delete("page");
    for (const [key, value] of [...params.entries()]) if (!value) params.delete(key);
    return `/admin/leads?${params}`;
  };
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams({ status, kind, ...(q ? { q } : {}), page: String(nextPage) });
    return `/admin/leads?${params}`;
  };
  const pill = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-lg px-3 text-sm ${active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`;

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Access requests and waitlist signups from the landing page. Move each one along; the badge in the sidebar counts what's still new."
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <nav aria-label="Status" className="flex flex-wrap gap-1">
          {[...LEAD_STATUSES, "all" as const].map((s) => (
            <Link key={s} href={href({ status: s })} className={pill(s === status)}>
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
            <Link key={k.value} href={href({ kind: k.value })} className={pill(k.value === kind)}>
              {k.label}
            </Link>
          ))}
        </nav>
      </div>

      <form action="/admin/leads" method="get" className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="kind" value={kind} />
        <label className="min-w-64 flex-1">
          <span className="text-xs font-medium text-neutral-600">Search leads</span>
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-400" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Name, email, city or phone"
              className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
            />
          </span>
        </label>
        <button className="h-11 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800">Search</button>
        {q && (
          <Link href={href({ q: "" })} className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-neutral-500 hover:text-neutral-900">
            <X className="h-4 w-4" aria-hidden /> Clear
          </Link>
        )}
      </form>

      <Card className="mt-4">
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <EmptyState
              title={status === "new" && !q ? "Inbox zero" : "Nothing here"}
              description={
                status === "new" && !q
                  ? "Every lead has been touched. New ones appear as the landing page collects them."
                  : "No leads match this search and filter."
              }
              className="py-12"
            />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {result.rows.map((lead) => (
                <LeadRowItem key={`${lead.kind}-${lead.id}`} lead={lead} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-neutral-500">
          {result.total.toLocaleString()} matching leads · Page {result.page} of {result.pageCount}
        </p>
        <nav aria-label="Lead pages" className="flex gap-2">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} className="inline-flex h-11 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 font-medium hover:bg-neutral-50">
              <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
            </Link>
          ) : (
            <span aria-disabled="true" className="inline-flex h-11 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-neutral-400">
              <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
            </span>
          )}
          {result.page < result.pageCount ? (
            <Link href={pageHref(result.page + 1)} className="inline-flex h-11 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 font-medium hover:bg-neutral-50">
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span aria-disabled="true" className="inline-flex h-11 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-neutral-400">
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </nav>
      </footer>
    </div>
  );
}

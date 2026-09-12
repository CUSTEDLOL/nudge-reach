import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { NewWorkspace } from "@/components/features/admin-shell/new-workspace";
import { OrgDirectory } from "@/components/features/admin-shell/org-directory";
import { PageHeader } from "@/components/ui/page-header";
import { requireFounder } from "@/modules/admin/auth";
import {
  ORG_MODES,
  ORG_READINESS,
  ORG_SORTS,
  ORG_STATES,
  orgsList,
  type OrgMode,
  type OrgReadiness,
  type OrgSort,
  type OrgState,
} from "@/modules/admin/queries";
import { assignablePlans } from "@/modules/admin/create-workspace";
import { COUNTRY_PRESETS } from "@/modules/billing/money";
import { PLANS } from "@/modules/billing/plans";
import { createWorkspaceAction } from "./actions";

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";
const pick = <T extends string>(value: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const STATE_LABEL: Record<OrgState, string> = {
  all: "Any billing state",
  trial: "On trial",
  paying: "Paying",
  past_due: "Past due",
  cancelled: "Cancelled",
  suspended: "Suspended",
  ended_trial: "Trial ended",
};

const READINESS_LABEL: Record<OrgReadiness, string> = {
  all: "Any readiness",
  ready: "Ready",
  blocked: "Setup blocked",
  degraded: "Needs attention",
};

const SORT_LABEL: Record<OrgSort, string> = {
  newest: "Newest first",
  name: "Name A–Z",
  last_activity: "Latest inbound",
  trial_end: "Trial ending soon",
  cost: "Highest AI cost",
};

const controlClass =
  "h-11 min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-800 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200";

/** Every workspace, with explicit setup readiness and launch-scale discovery. */
export default async function AdminOrgsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireFounder();
  const search = await searchParams;
  const q = one(search.q).trim();
  const requestedPlan = one(search.plan) || "all";
  const plan = requestedPlan === "all" || PLANS.some((item) => item.id === requestedPlan)
    ? requestedPlan
    : "all";
  const mode = pick<OrgMode>(one(search.mode), ORG_MODES, "all");
  const state = pick<OrgState>(one(search.state), ORG_STATES, "all");
  const readiness = pick<OrgReadiness>(one(search.readiness), ORG_READINESS, "all");
  const sort = pick<OrgSort>(one(search.sort), ORG_SORTS, "newest");
  const requestedPage = Number(one(search.page));
  const page = Number.isFinite(requestedPage) ? requestedPage : 1;

  const result = await orgsList({ search: q, plan, mode, state, readiness, sort, page });
  const baseParams: Record<string, string> = {};
  if (q) baseParams.q = q;
  if (plan !== "all") baseParams.plan = plan;
  if (mode !== "all") baseParams.mode = mode;
  if (state !== "all") baseParams.state = state;
  if (readiness !== "all") baseParams.readiness = readiness;
  if (sort !== "newest") baseParams.sort = sort;
  const filtered = Object.keys(baseParams).length > 0;

  return (
    <div>
      <PageHeader
        title="Organisations"
        description="Find a workspace, see whether it can deliver the Front Desk outcome, then open the full account record."
      />

      <NewWorkspace
        action={createWorkspaceAction}
        countries={COUNTRY_PRESETS.filter((c) => c.code !== "OTHER").map((c) => ({
          code: c.code,
          label: c.label,
          currency: c.currency,
        }))}
        plans={assignablePlans().map((p) => ({ id: p.id, name: p.name }))}
      />

      <form
        action="/admin/orgs"
        method="get"
        className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 sm:p-4"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Directory controls
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,2fr)_repeat(5,minmax(8.5rem,1fr))_auto]">
          <label className="relative sm:col-span-2 xl:col-span-1">
            <span className="sr-only">Search organisations</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-400" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Name, email, org ID or phone ID"
              className={`${controlClass} w-full pl-9`}
            />
          </label>
          <label>
            <span className="sr-only">Plan</span>
            <select name="plan" defaultValue={plan} className={`${controlClass} w-full`}>
              <option value="all">Any plan</option>
              {PLANS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Mode</span>
            <select name="mode" defaultValue={mode} className={`${controlClass} w-full`}>
              <option value="all">Live + test</option>
              <option value="live">Live only</option>
              <option value="test">Test only</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Billing state</span>
            <select name="state" defaultValue={state} className={`${controlClass} w-full`}>
              {ORG_STATES.map((value) => <option key={value} value={value}>{STATE_LABEL[value]}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Readiness</span>
            <select name="readiness" defaultValue={readiness} className={`${controlClass} w-full`}>
              {ORG_READINESS.map((value) => <option key={value} value={value}>{READINESS_LABEL[value]}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Sort order</span>
            <select name="sort" defaultValue={sort} className={`${controlClass} w-full`}>
              {ORG_SORTS.map((value) => <option key={value} value={value}>{SORT_LABEL[value]}</option>)}
            </select>
          </label>
          <button className="h-11 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800">
            Apply
          </button>
        </div>
        {filtered && (
          <div className="mt-2 flex justify-end">
            <Link href="/admin/orgs" className="inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-neutral-500 hover:text-neutral-900">
              <X className="h-4 w-4" aria-hidden /> Reset filters
            </Link>
          </div>
        )}
      </form>

      <OrgDirectory
        rows={result.rows}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        sort={sort}
        baseParams={baseParams}
      />
    </div>
  );
}

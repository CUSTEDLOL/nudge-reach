import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import { ORG_MODES, ORG_STATES, orgsList, type OrgMode, type OrgState } from "@/modules/admin/queries";
import { formatMicroUsd } from "@/modules/analytics/compute";
import { getPlan, PLANS } from "@/modules/billing/plans";
import { trialDaysLeft } from "@/modules/billing/trial";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pick = <T extends string>(v: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

const STATE_LABEL: Record<OrgState, string> = {
  all: "All",
  trial: "On trial",
  paying: "Paying",
  past_due: "Past due",
  cancelled: "Cancelled",
  suspended: "Suspended",
  ended_trial: "Trial ended",
};
const selectCls =
  "h-9 rounded-lg border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-neutral-500";

/** Every workspace, filterable by the states a founder acts on. */
export default async function AdminOrgsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireFounder();
  const sp = await searchParams;
  const q = one(sp.q);
  const plan = one(sp.plan) || "all";
  const mode = pick<OrgMode>(one(sp.mode), ORG_MODES, "all");
  const state = pick<OrgState>(one(sp.state), ORG_STATES, "all");
  const cursor = one(sp.cursor) || undefined;
  const { rows, nextCursor } = await orgsList({ search: q, plan, mode, state, cursor });

  const params = (extra: Record<string, string>) => {
    const base: Record<string, string> = {};
    if (q) base.q = q;
    if (plan !== "all") base.plan = plan;
    if (mode !== "all") base.mode = mode;
    if (state !== "all") base.state = state;
    return `/admin/orgs?${new URLSearchParams({ ...base, ...extra })}`;
  };
  const pill = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm ${active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`;
  const filtered = Boolean(q) || plan !== "all" || mode !== "all" || state !== "all";

  return (
    <div>
      <PageHeader
        title="Organisations"
        description="Every workspace on the platform. Click a name to manage it."
        actions={
          <form className="flex gap-2" action="/admin/orgs" method="get">
            {plan !== "all" && <input type="hidden" name="plan" value={plan} />}
            {mode !== "all" && <input type="hidden" name="mode" value={mode} />}
            {state !== "all" && <input type="hidden" name="state" value={state} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Name, member email, org id or phone-number id"
              className="h-9 w-72 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-neutral-500"
            />
            <button className="h-9 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white">Search</button>
          </form>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <nav aria-label="State" className="flex flex-wrap gap-1">
          {ORG_STATES.map((s) => (
            <Link key={s} href={params(s === "all" ? {} : { state: s })} className={pill(s === state)}>
              {STATE_LABEL[s]}
            </Link>
          ))}
        </nav>
        <span className="mx-1 hidden h-5 w-px bg-neutral-200 sm:block" />
        <form action="/admin/orgs" method="get" className="flex items-center gap-2">
          {q && <input type="hidden" name="q" value={q} />}
          {state !== "all" && <input type="hidden" name="state" value={state} />}
          <select name="plan" defaultValue={plan} className={selectCls} aria-label="Plan">
            <option value="all">Any plan</option>
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select name="mode" defaultValue={mode} className={selectCls} aria-label="Mode">
            <option value="all">Live + test</option>
            <option value="live">Live only</option>
            <option value="test">Test only</option>
          </select>
          <button className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium hover:bg-neutral-50">
            Apply
          </button>
          {filtered && (
            <Link href="/admin/orgs" className="text-sm text-neutral-500 hover:text-neutral-900">
              Clear
            </Link>
          )}
        </form>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr className="border-b border-neutral-200">
              <th className="px-4 py-2.5 font-medium">Organisation</th>
              <th className="px-3 py-2.5 font-medium">Plan</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Numbers</th>
              <th className="px-3 py-2.5 text-right font-medium">Contacts</th>
              <th className="px-3 py-2.5 text-right font-medium">Seats</th>
              <th className="px-3 py-2.5 text-right font-medium">AI cost 30d</th>
              <th className="px-3 py-2.5 font-medium">Last inbound</th>
              <th className="px-4 py-2.5 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const trialLeft = trialDaysLeft(o.trialEndsAt);
              return (
                <tr key={o.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/orgs/${o.id}`} className="font-medium hover:underline">
                      {o.name}
                    </Link>
                    <p className="text-xs text-neutral-400">
                      {o.ownerEmail ?? "no owner email"}
                      {o.vertical && ` · ${o.vertical}`}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">{getPlan(o.plan).name}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {o.suspended && <Badge tone="danger">suspended</Badge>}
                      <Badge tone={o.simulated ? "warning" : "success"}>{o.simulated ? "test" : "live"}</Badge>
                      {o.subscriptionStatus === "active" && <Badge tone="success">paying</Badge>}
                      {o.subscriptionStatus === "past_due" && <Badge tone="danger">past due</Badge>}
                      {o.subscriptionStatus === "cancelled" && <Badge tone="neutral">cancelled</Badge>}
                      {trialLeft !== null && o.subscriptionStatus !== "active" && (
                        <Badge tone={trialLeft <= 3 ? "warning" : "info"}>
                          {trialLeft === 0 ? "trial ended" : `trial ${trialLeft}d`}
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{o.numbers}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{o.contacts.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{o.members}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatMicroUsd(o.aiCostMicroUsd30d)}</td>
                  <td className="px-3 py-2.5 text-xs text-neutral-500">
                    {o.lastInboundAt ? o.lastInboundAt.toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-500">{o.createdAt.toLocaleDateString("en-GB")}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-neutral-400">
                  No organisations match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-4 text-right">
          <Link
            href={params({ cursor: nextCursor })}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
          >
            Next 50 →
          </Link>
        </div>
      )}
    </div>
  );
}

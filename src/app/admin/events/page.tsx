import Link from "next/link";
import { Filter, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireFounder } from "@/modules/admin/auth";
import {
  EVENT_RANGES,
  eventsOverview,
  parseEventsDays,
} from "@/modules/admin/events";

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

const controlClass =
  "h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200";

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string | string[];
    type?: string | string[];
    vertical?: string | string[];
    orgId?: string | string[];
  }>;
}) {
  await requireFounder();
  const search = await searchParams;
  const days = parseEventsDays(search.days);
  const type = one(search.type).trim();
  const vertical = one(search.vertical).trim();
  const orgId = one(search.orgId).trim();
  const events = await eventsOverview({ days, type, vertical, orgId });
  const grandTotal = events.typeTotals.reduce((sum, row) => sum + row.count, 0);
  const daily = events.byDay.map((row) => ({
    ...row,
    total: Object.values(row.counts).reduce((sum, count) => sum + count, 0),
  }));
  const busiestDay = daily.reduce<(typeof daily)[number] | null>(
    (highest, row) => (!highest || row.total > highest.total ? row : highest),
    null
  );
  const topType = events.typeTotals[0] ?? null;
  const maxDaily = Math.max(1, ...daily.map((row) => row.total));
  const chartSummary = grandTotal === 0
    ? `No events in the selected ${days}-day range.`
    : `${grandTotal} events total. Highest-volume day: ${busiestDay?.label} with ${busiestDay?.total}. Highest-volume type: ${topType?.type} with ${topType?.count}.`;
  const eventOptions = type && !events.eventTypes.includes(type)
    ? [type, ...events.eventTypes]
    : events.eventTypes;
  const verticalOptions = vertical && !events.verticals.includes(vertical)
    ? [vertical, ...events.verticals]
    : events.verticals;

  const pageHref = (extra: Record<string, string>) => {
    const params = new URLSearchParams({
      days: String(days),
      ...(type ? { type } : {}),
      ...(vertical ? { vertical } : {}),
      ...(orgId ? { orgId } : {}),
      ...extra,
    });
    for (const [key, value] of [...params.entries()]) if (!value) params.delete(key);
    return `/admin/events?${params}`;
  };
  const filtered = Boolean(type || vertical || orgId);

  return (
    <div>
      <PageHeader
        title="Events & demand"
        description="Explore which customer and revenue events are occurring, where, and for which verticals."
        actions={
          <nav aria-label="Date range" className="flex gap-1 text-sm">
            {EVENT_RANGES.map((range) => (
              <Link
                key={range}
                href={pageHref({ days: String(range) })}
                aria-current={range === days ? "page" : undefined}
                className={`inline-flex h-11 items-center rounded-lg px-3 ${range === days ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
              >
                {range}d
              </Link>
            ))}
          </nav>
        }
      />

      <form action="/admin/events" method="get" className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 sm:p-4">
        <input type="hidden" name="days" value={days} />
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Filter className="h-3.5 w-3.5" aria-hidden /> Demand filters
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto]">
          <label>
            <span className="sr-only">Event type</span>
            <select name="type" defaultValue={type} className={controlClass}>
              <option value="">All event types</option>
              {eventOptions.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Business vertical</span>
            <select name="vertical" defaultValue={vertical} className={controlClass}>
              <option value="">All verticals</option>
              {verticalOptions.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="relative">
            <span className="sr-only">Organization ID</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-400" aria-hidden />
            <input name="orgId" defaultValue={orgId} placeholder="Organisation ID · use global search" className={`${controlClass} pl-9`} />
          </label>
          <button className="h-11 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800">Apply</button>
        </div>
        {filtered && (
          <div className="mt-2 flex justify-end">
            <Link href={`/admin/events?days=${days}`} className="inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-neutral-500 hover:text-neutral-900">
              <X className="h-4 w-4" aria-hidden /> Clear filters
            </Link>
          </div>
        )}
      </form>

      <section className="mt-5 rounded-xl border border-neutral-200 bg-white p-4" aria-labelledby="event-series-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="event-series-heading" className="text-sm font-semibold">Event volume by day</h2>
          <p className="text-xs text-neutral-500">{grandTotal.toLocaleString()} events · {days} days</p>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{chartSummary}</p>
        <div role="img" aria-label={chartSummary} className="mt-4 flex h-40 items-end gap-0.5 border-b border-neutral-200 px-0.5">
          {daily.map((row) => (
            <div key={row.label} className="group relative flex h-full min-w-0 flex-1 items-end">
              <div
                className="w-full rounded-t-sm bg-brand-500/80 group-hover:bg-brand-600"
                style={{ height: `${(row.total / maxDaily) * 100}%`, minHeight: row.total > 0 ? 3 : 0 }}
                title={`${row.label}: ${row.total}`}
              />
            </div>
          ))}
        </div>

        <details className="mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-neutral-700 hover:text-neutral-900">Show exact daily values</summary>
          <div className="max-h-80 overflow-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <caption className="sr-only">Exact daily event values for the selected filters</caption>
              <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Day</th>
                  {events.typeTotals.map((row) => <th key={row.type} scope="col" className="px-3 py-2 text-right font-medium">{row.type.replaceAll("_", " ")}</th>)}
                  <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {daily.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium">{row.label}</th>
                    {events.typeTotals.map((typeRow) => <td key={typeRow.type} className="px-3 py-2 text-right tabular-nums">{row.counts[typeRow.type] ?? 0}</td>)}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Events by type</h2>
          {events.typeTotals.length === 0 ? <p className="py-6 text-center text-sm text-neutral-400">No events in range.</p> : (
            <table className="mt-3 w-full text-sm"><tbody>{events.typeTotals.map((row) => (
              <tr key={row.type} className="border-t border-neutral-100"><td className="py-2 font-mono text-xs">{row.type}</td><td className="py-2 text-right tabular-nums">{row.count}</td></tr>
            ))}</tbody></table>
          )}
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Signups by vertical</h2>
          {events.signupsByVertical.length === 0 ? <p className="py-6 text-center text-sm text-neutral-400">No signups in range.</p> : (
            <table className="mt-3 w-full text-sm"><tbody>{events.signupsByVertical.map((row) => (
              <tr key={row.vertical} className="border-t border-neutral-100"><td className="py-2 capitalize">{row.vertical.replaceAll("_", " ")}</td><td className="py-2 text-right tabular-nums">{row.count}</td></tr>
            ))}</tbody></table>
          )}
        </section>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Recent matching events</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500"><tr className="border-b border-neutral-200"><th className="py-2 font-medium">Type</th><th className="py-2 font-medium">Organisation</th><th className="py-2 text-right font-medium">When</th></tr></thead>
            <tbody>
              {events.recent.map((event) => (
                <tr key={`${event.orgId}-${event.type}-${event.createdAt.toISOString()}`} className="border-t border-neutral-100">
                  <td className="py-2 font-mono text-xs">{event.type}</td>
                  <td className="py-2"><Link href={`/admin/orgs/${event.orgId}`} className="font-medium hover:underline">{event.orgName}</Link></td>
                  <td className="py-2 text-right text-xs text-neutral-500">{event.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                </tr>
              ))}
              {events.recent.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-neutral-400">Nothing matches these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

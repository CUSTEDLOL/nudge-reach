import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import { eventsOverview } from "@/modules/admin/events";
import { parseRange } from "@/modules/analytics/compute";

const RANGES = [7, 30, 90] as const;

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  await requireFounder();
  const days = parseRange((await searchParams).days);
  const ev = await eventsOverview(days);
  const grandTotal = ev.typeTotals.reduce((s, t) => s + t.count, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Events &amp; demand</h1>
        <nav className="flex gap-1 text-sm">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/events?days=${r}`}
              className={`rounded-lg px-3 py-1 ${r === days ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
            >
              {r}d
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">
            Events by type ({grandTotal.toLocaleString()} in {days}d)
          </h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {ev.typeTotals.map((t) => (
                <tr key={t.type} className="border-t border-neutral-100">
                  <td className="py-1.5 font-mono text-xs">{t.type}</td>
                  <td className="py-1.5 text-right tabular-nums">{t.count}</td>
                </tr>
              ))}
              {ev.typeTotals.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-neutral-400">
                    No events in range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Signups by vertical ({days}d)</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {ev.signupsByVertical.map((v) => (
                <tr key={v.vertical} className="border-t border-neutral-100">
                  <td className="py-1.5 capitalize">{v.vertical.replaceAll("_", " ")}</td>
                  <td className="py-1.5 text-right tabular-nums">{v.count}</td>
                </tr>
              ))}
              {ev.signupsByVertical.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-neutral-400">
                    No signups in range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-neutral-400">
            The which-vertical-demand view: what industries new signups pick.
          </p>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">Recent events</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="py-1.5">Type</th>
                <th className="py-1.5">Org</th>
                <th className="py-1.5 text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {ev.recent.map((e, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="py-1.5 font-mono text-xs">{e.type}</td>
                  <td className="py-1.5">{e.orgName}</td>
                  <td className="py-1.5 text-right text-xs text-neutral-500">
                    {e.createdAt.toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
              ))}
              {ev.recent.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-neutral-400">
                    Nothing yet — events accrue as customers act.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

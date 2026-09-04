import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import { orgsList } from "@/modules/admin/queries";
import { formatMicroUsd } from "@/modules/analytics/compute";

function param(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminOrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; cursor?: string | string[] }>;
}) {
  await requireFounder();
  const sp = await searchParams;
  const q = param(sp.q);
  const cursor = param(sp.cursor);
  const { rows, nextCursor } = await orgsList({ search: q, cursor });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Orgs</h1>
        <form className="flex gap-2" action="/admin/orgs" method="get">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or member email…"
            className="w-64 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
          />
          <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white">
            Search
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-500">
            <tr className="border-b border-neutral-200">
              <th className="px-3 py-2">Org</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2 text-right">Numbers</th>
              <th className="px-3 py-2 text-right">Contacts</th>
              <th className="px-3 py-2 text-right">Seats</th>
              <th className="px-3 py-2 text-right">AI cost 30d</th>
              <th className="px-3 py-2">Last inbound</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-2">
                  <Link href={`/admin/orgs/${o.id}`} className="font-medium hover:underline">
                    {o.name}
                  </Link>
                  <p className="text-xs text-neutral-400">{o.ownerEmail ?? "—"}</p>
                </td>
                <td className="px-3 py-2 capitalize">{o.plan}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${o.simulated ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
                  >
                    {o.simulated ? "test" : "live"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{o.numbers}</td>
                <td className="px-3 py-2 text-right tabular-nums">{o.contacts}</td>
                <td className="px-3 py-2 text-right tabular-nums">{o.members}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMicroUsd(o.aiCostMicroUsd30d)}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-500">
                  {o.lastInboundAt ? o.lastInboundAt.toLocaleDateString("en-GB") : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-500">
                  {o.createdAt.toLocaleDateString("en-GB")}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-neutral-400">
                  No orgs match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-4 text-right">
          <Link
            href={`/admin/orgs?${new URLSearchParams({ ...(q ? { q } : {}), cursor: nextCursor })}`}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
          >
            Next 50 →
          </Link>
        </div>
      )}
    </div>
  );
}

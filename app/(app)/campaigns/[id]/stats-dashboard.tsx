"use client";

import { useEffect, useState } from "react";
import { BarChart3, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface CampaignStatsView {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  actualCostMinor: number;
  settled: boolean;
}

function MetricTile({
  label,
  value,
  total,
  accent,
}: {
  label: string;
  value: number;
  total: number;
  accent: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${accent}`}>
        {value}
      </p>
      <p className="text-xs text-neutral-400">{pct}%</p>
    </div>
  );
}

export function StatsDashboard({
  campaignId,
  status: initialStatus,
  stats: initialStats,
  ratePaise,
  simulation,
}: {
  campaignId: string;
  status: string;
  stats: CampaignStatsView;
  ratePaise: number;
  simulation: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [stats, setStats] = useState(initialStats);

  // Poll a lightweight JSON endpoint and update only the numbers — no
  // full-page refresh, so the preview/header don't flicker. Stop once the
  // campaign has settled (queue drained + delivery window elapsed).
  useEffect(() => {
    if (stats.settled) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/stats`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          status: string;
          stats: CampaignStatsView;
        };
        if (cancelled) return;
        setStatus(data.status);
        setStats(data.stats);
      } catch {
        // transient network error — try again on the next tick
      }
    }

    const timer = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [campaignId, stats.settled]);

  const doneCount = stats.total - stats.queued;
  const estimatedCostMinor = stats.total * ratePaise;
  const sending = status === "SENDING";

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          {sending ? (
            <>
              <Send className="h-4 w-4 text-brand-600" aria-hidden />
              Sending…
            </>
          ) : (
            <>
              <BarChart3 className="h-4 w-4 text-brand-600" aria-hidden />
              Results
            </>
          )}
          {simulation && <Badge tone="info">simulated</Badge>}
        </h2>
        <p className="text-sm text-neutral-500">
          {doneCount}/{stats.total} processed
        </p>
      </div>

      <Progress
        value={doneCount}
        max={stats.total}
        label="Send progress"
        className="mt-3"
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MetricTile label="Sent" value={stats.sent} total={stats.total} accent="text-neutral-900" />
        <MetricTile label="Delivered" value={stats.delivered} total={stats.total} accent="text-emerald-600" />
        <MetricTile label="Read" value={stats.read} total={stats.total} accent="text-sky-600" />
        <MetricTile label="Clicked" value={stats.clicked} total={stats.total} accent="text-violet-600" />
        <MetricTile label="Failed" value={stats.failed} total={stats.total} accent="text-red-500" />
      </div>

      <div className="mt-4 flex flex-wrap gap-6 rounded-xl bg-neutral-50 p-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Estimated cost
          </p>
          <p className="mt-0.5 font-semibold text-neutral-900">
            ₹{(estimatedCostMinor / 100).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {simulation ? "Cost so far (simulated)" : "Actual cost so far"}
          </p>
          <p className="mt-0.5 font-semibold text-neutral-900">
            ₹{(stats.actualCostMinor / 100).toFixed(2)}
          </p>
          <p className="text-xs text-neutral-400">
            billed per delivered message
          </p>
        </div>
      </div>
    </Card>
  );
}

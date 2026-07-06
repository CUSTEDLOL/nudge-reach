"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/features/charts/chart-tooltip";

export interface VolumeChartPoint {
  /** Short day label, e.g. "2 Jul". */
  label: string;
  inbound: number;
  outbound: number;
}

// Brand palette (app/globals.css): brand-500 primary, brand-300 secondary.
const OUTBOUND = "#06c167";
const INBOUND = "#6fe3a8";
const AXIS = "#a3a3a3"; // neutral-400

/**
 * Stacked daily message volume (inbound vs outbound). Server components pass
 * pre-serialized points from `lib/analytics/queries.messageVolumeByDay`.
 */
export function AreaVolumeChart({
  data,
  height = 280,
}: {
  data: VolumeChartPoint[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="nudge-fill-outbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={OUTBOUND} stopOpacity={0.26} />
              <stop offset="100%" stopColor={OUTBOUND} stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="nudge-fill-inbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INBOUND} stopOpacity={0.32} />
              <stop offset="100%" stopColor={INBOUND} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#e5e5e5"
            strokeDasharray="2 6"
            strokeOpacity={0.7}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: AXIS }}
            minTickGap={28}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: AXIS }}
            allowDecimals={false}
            width={40}
          />
          <Tooltip
            content={ChartTooltip}
            cursor={{ stroke: "#d4d4d4", strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="outbound"
            name="Outbound"
            stackId="volume"
            stroke={OUTBOUND}
            strokeWidth={2}
            fill="url(#nudge-fill-outbound)"
          />
          <Area
            type="monotone"
            dataKey="inbound"
            name="Inbound"
            stackId="volume"
            stroke={INBOUND}
            strokeWidth={2}
            fill="url(#nudge-fill-inbound)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

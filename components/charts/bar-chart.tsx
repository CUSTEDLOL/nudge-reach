"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

export interface BarPoint {
  label: string;
  value: number;
}

/**
 * Simple vertical bar chart in brand colors — the generic wrapper for any
 * label/value series (tag usage, per-campaign counts, …).
 */
export function SimpleBarChart({
  data,
  height = 240,
  color = "#06c167",
  name = "Count",
}: {
  data: BarPoint[];
  height?: number;
  color?: string;
  name?: string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
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
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            minTickGap={16}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            allowDecimals={false}
            width={40}
          />
          <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(6, 193, 103, 0.06)" }} />
          <Bar dataKey="value" name={name} fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

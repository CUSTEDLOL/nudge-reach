"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

export interface FunnelBarPoint {
  /** Stage label, e.g. "Qualified". */
  label: string;
  count: number;
}

// Brand ramp for the pipeline; the terminal "Lost" stage stays neutral.
const STAGE_COLORS = ["#6fe3a8", "#37ce86", "#06c167", "#02a258", "#d4d4d4"];

/** Horizontal lead-funnel bars (contacts per pipeline stage). */
export function FunnelBars({
  data,
  height = 232,
}: {
  data: FunnelBarPoint[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 36, bottom: 4, left: 0 }}
          barCategoryGap={10}
        >
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#737373" }}
            width={72}
          />
          <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(6, 193, 103, 0.06)" }} />
          <Bar dataKey="count" name="Contacts" barSize={18} radius={4}>
            {data.map((point, index) => (
              <Cell
                key={point.label}
                fill={STAGE_COLORS[index % STAGE_COLORS.length]}
              />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              style={{ fontSize: 11, fill: "#525252" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTransition } from "react";
import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toggleAutomation } from "./actions";
import { triggerMeta } from "./meta";

export interface AutomationRow {
  id: string;
  name: string;
  description: string;
  trigger: string;
  keywords: string[];
  stepsCount: number;
  runsCount: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
}

const RUN_TONES: Record<string, BadgeTone> = {
  COMPLETED: "success",
  FAILED: "danger",
  WAITING: "warning",
  RUNNING: "info",
};

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function AutomationsList({
  rows,
  canManage,
}: {
  rows: AutomationRow[];
  canManage: boolean;
}) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow className="border-t-0 hover:bg-transparent">
            <TableHead className="pl-5">Automation</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Steps</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last run</TableHead>
            <TableHead className="pr-5 text-right">Runs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <AutomationListRow key={row.id} row={row} canManage={canManage} />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function AutomationListRow({
  row,
  canManage,
}: {
  row: AutomationRow;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const meta = triggerMeta(row.trigger);
  const TriggerIcon = meta.icon;

  function onToggle(next: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("automationId", row.id);
      formData.set("enabled", String(next));
      const result = await toggleAutomation(formData);
      toast({
        description: result.message,
        tone: result.ok ? "success" : "error",
      });
    });
  }

  return (
    <TableRow>
      <TableCell className="max-w-[22rem] pl-5">
        <Link
          href={`/automations/${row.id}`}
          className="font-medium text-neutral-900 outline-none transition-colors duration-150 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400/50"
        >
          {row.name}
        </Link>
        {row.description && (
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {row.description}
          </p>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={meta.tone}>
            <TriggerIcon className="h-3 w-3" aria-hidden />
            {meta.label}
          </Badge>
          {row.keywords.slice(0, 2).map((keyword) => (
            <span
              key={keyword}
              className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-600"
            >
              {keyword}
            </span>
          ))}
          {row.keywords.length > 2 && (
            <span className="text-xs text-neutral-400">
              +{row.keywords.length - 2}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-neutral-600">
        {row.stepsCount} step{row.stepsCount === 1 ? "" : "s"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={row.enabled}
            onCheckedChange={onToggle}
            disabled={!canManage || pending}
            aria-label={`${row.enabled ? "Pause" : "Enable"} ${row.name}`}
          />
          <span className="text-xs text-neutral-500">
            {row.enabled ? "On" : "Paused"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {row.lastRunAt ? (
          <div className="flex items-center gap-2">
            <span className="text-neutral-600">
              {dateFormat.format(new Date(row.lastRunAt))}
            </span>
            {row.lastRunStatus && (
              <Badge tone={RUN_TONES[row.lastRunStatus] ?? "neutral"}>
                {row.lastRunStatus.toLowerCase()}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-neutral-400">Never</span>
        )}
      </TableCell>
      <TableCell className="pr-5 text-right">
        <Link
          href={`/automations/${row.id}/runs`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 outline-none transition-colors duration-150 hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-400/50"
        >
          <History className="h-3.5 w-3.5" aria-hidden />
          {row.runsCount} run{row.runsCount === 1 ? "" : "s"}
        </Link>
      </TableCell>
    </TableRow>
  );
}

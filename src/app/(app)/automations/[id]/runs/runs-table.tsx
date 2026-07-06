"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { RunLogEntry } from "@/modules/automation/definitions";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RunLog } from "../../run-log";

export interface RunRow {
  id: string;
  status: string;
  contactName: string;
  contactPhone: string;
  contactId: string | null;
  startedAt: string;
  resumeAt: string | null;
  stepsCompleted: number;
  totalSteps: number;
  log: RunLogEntry[];
}

const STATUS_TONES: Record<string, BadgeTone> = {
  RUNNING: "info",
  WAITING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
};

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function RunsTable({ rows }: { rows: RunRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow className="border-t-0 hover:bg-transparent">
            <TableHead className="w-10 pl-5" aria-label="Expand" />
            <TableHead>Status</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="pr-5">Steps completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isOpen = expanded === row.id;
            return (
              <Fragment key={row.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : row.id)}
                >
                  <TableCell className="pl-5">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Collapse" : "Expand"} run log`}
                      className="rounded-lg p-1 text-neutral-400 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-brand-400/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(isOpen ? null : row.id);
                      }}
                    >
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transition-transform duration-150",
                          isOpen && "rotate-90"
                        )}
                        aria-hidden
                      />
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS_TONES[row.status] ?? "neutral"}>
                      {row.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.contactId ? (
                      <div>
                        <span className="font-medium text-neutral-900">
                          {row.contactName}
                        </span>
                        {row.contactPhone && (
                          <span className="ml-2 font-mono text-xs text-neutral-400">
                            {row.contactPhone}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-neutral-600">
                    {dateFormat.format(new Date(row.startedAt))}
                  </TableCell>
                  <TableCell className="pr-5 text-neutral-600">
                    {row.stepsCompleted} / {row.totalSteps}
                    {row.status === "WAITING" && row.resumeAt && (
                      <span className="ml-2 text-xs text-amber-600">
                        resumes {dateFormat.format(new Date(row.resumeAt))}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="bg-neutral-50/60 px-5 py-4">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                        Step log
                      </p>
                      <RunLog entries={row.log} />
                      {row.contactId && (
                        <Link
                          href={`/contacts/${row.contactId}`}
                          className="mt-3 inline-block text-xs font-medium text-brand-700 transition-colors duration-150 hover:text-brand-800"
                        >
                          View contact →
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

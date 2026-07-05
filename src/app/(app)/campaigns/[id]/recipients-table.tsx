"use client";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export interface RecipientRow {
  id: string;
  name: string;
  phone: string;
  status: string;
  costMinor: number | null;
  sentAt: string | null; // ISO
}

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  QUEUED: { label: "Queued", tone: "neutral" },
  SENT: { label: "Sent", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "success" },
  READ: { label: "Read", tone: "brand" },
  CLICKED: { label: "Clicked", tone: "brand" },
  FAILED: { label: "Failed", tone: "danger" },
};

const timeFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

// Columns depend on the workspace's currency symbol (global outreach).
const buildColumns = (
  currencySymbol: string
): DataTableColumn<RecipientRow>[] => [
  {
    key: "name",
    header: "Contact",
    sortValue: (r) => r.name,
    cell: (r) => <span className="font-medium text-neutral-900">{r.name}</span>,
  },
  {
    key: "phone",
    header: "Phone",
    cell: (r) => (
      <span className="font-mono text-xs text-neutral-500">{r.phone}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => {
      const meta = STATUS_META[r.status] ?? STATUS_META.QUEUED;
      return <Badge tone={meta.tone}>{meta.label}</Badge>;
    },
  },
  {
    key: "cost",
    header: "Cost",
    align: "right",
    sortValue: (r) => r.costMinor ?? 0,
    cell: (r) => (
      <span className="tabular-nums">
        {r.costMinor != null ? `${currencySymbol}${(r.costMinor / 100).toFixed(2)}` : "—"}
      </span>
    ),
  },
  {
    key: "sentAt",
    header: "Sent at",
    sortValue: (r) => (r.sentAt ? new Date(r.sentAt) : null),
    cell: (r) => (
      <span className="text-neutral-500">
        {r.sentAt ? timeFmt.format(new Date(r.sentAt)) : "—"}
      </span>
    ),
  },
];

/** Per-recipient delivery table shown under the stats (SENDING/SENT). */
export function RecipientsTable({
  rows,
  currencySymbol = "₹",
}: {
  rows: RecipientRow[];
  currencySymbol?: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-neutral-900">
        Recipients{" "}
        <span className="font-normal text-neutral-400">({rows.length})</span>
      </h2>
      <DataTable
        columns={buildColumns(currencySymbol)}
        rows={rows}
        rowKey={(r) => r.id}
        searchValue={(r) => `${r.name} ${r.phone}`}
        searchPlaceholder="Search recipients…"
        emptyMessage="No recipients queued yet."
        pageSize={10}
      />
    </section>
  );
}

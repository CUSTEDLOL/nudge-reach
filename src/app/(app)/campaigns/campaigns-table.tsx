"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, ShoppingBag } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  photoUrl: string | null;
  audienceName: string | null;
  scheduledAt: string | null; // ISO
  createdAt: string; // ISO
  sent: number;
  delivered: number;
  read: number;
  costMinor: number;
}

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  TEMPLATE_PENDING: { label: "In review", tone: "warning" },
  TEMPLATE_APPROVED: { label: "Ready to send", tone: "brand" },
  SENDING: { label: "Sending", tone: "info" },
  SENT: { label: "Sent", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
};

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function StatusCell({ row }: { row: CampaignRow }) {
  const meta = STATUS_META[row.status] ?? STATUS_META.DRAFT;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge tone={meta.tone}>{meta.label}</Badge>
      {row.status === "SCHEDULED" && row.scheduledAt && (
        <span className="text-xs text-neutral-500">
          {dateTimeFmt.format(new Date(row.scheduledAt))}
        </span>
      )}
    </div>
  );
}

const buildColumns = (
  currencySymbol: string
): DataTableColumn<CampaignRow>[] => [
  {
    key: "name",
    header: "Campaign",
    sortValue: (r) => r.name,
    cell: (r) => (
      <div className="flex items-center gap-3">
        {r.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.photoUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <ShoppingBag className="h-4 w-4" aria-hidden />
          </span>
        )}
        <span className="font-medium text-neutral-900">{r.name}</span>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <StatusCell row={r} />,
  },
  {
    key: "audience",
    header: "Audience",
    sortValue: (r) => r.audienceName ?? "",
    cell: (r) =>
      r.audienceName ? (
        <span className="text-neutral-700">{r.audienceName}</span>
      ) : (
        <span className="text-neutral-400">—</span>
      ),
  },
  {
    key: "sent",
    header: "Sent",
    align: "right",
    sortValue: (r) => r.sent,
    cell: (r) => <span className="tabular-nums">{r.sent}</span>,
  },
  {
    key: "delivered",
    header: "Delivered",
    align: "right",
    sortValue: (r) => r.delivered,
    cell: (r) => <span className="tabular-nums">{r.delivered}</span>,
  },
  {
    key: "read",
    header: "Read",
    align: "right",
    sortValue: (r) => r.read,
    cell: (r) => <span className="tabular-nums">{r.read}</span>,
  },
  {
    key: "cost",
    header: "Cost",
    align: "right",
    sortValue: (r) => r.costMinor,
    cell: (r) => (
      <span className="tabular-nums">
        {r.costMinor > 0 ? `${currencySymbol}${(r.costMinor / 100).toFixed(2)}` : "—"}
      </span>
    ),
  },
  {
    key: "created",
    header: "Created",
    sortValue: (r) => new Date(r.createdAt),
    cell: (r) => (
      <span className="text-neutral-500">
        {dateFmt.format(new Date(r.createdAt))}
      </span>
    ),
  },
];

export function CampaignsTable({
  rows,
  currencySymbol = "₹",
}: {
  rows: CampaignRow[];
  currencySymbol?: string;
}) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone className="h-5 w-5" aria-hidden />}
        title="Your first broadcast is one photo away"
        description="Upload a product photo — we write the message, the offer and the buttons for you."
        action={
          <Link href="/campaigns/new" className={buttonVariants()}>
            New broadcast
          </Link>
        }
      />
    );
  }

  return (
    <DataTable
      columns={buildColumns(currencySymbol)}
      rows={rows}
      rowKey={(r) => r.id}
      searchValue={(r) => `${r.name} ${r.audienceName ?? ""}`}
      searchPlaceholder="Search campaigns…"
      initialSort={{ key: "created", dir: "desc" }}
      onRowClick={(r) => router.push(`/campaigns/${r.id}`)}
      pageSize={12}
    />
  );
}

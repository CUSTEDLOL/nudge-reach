import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  MessagesSquare,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCount, formatMajorAmount } from "@/modules/dashboard/format";
import type { OperationsSummaryItem } from "@/modules/dashboard/stats";

const OPERATION_ICON: Record<OperationsSummaryItem["key"], LucideIcon> = {
  bookings: CalendarDays,
  conversations: MessagesSquare,
  followups: RefreshCw,
  payments: CreditCard,
};

function operationDetail(
  item: OperationsSummaryItem,
  currency: string
): string {
  if (item.key === "bookings") {
    return `${formatCount(item.detailCount)} ${item.detailLabel}`;
  }
  if (item.key === "payments") {
    return `${formatMajorAmount(item.amountMinor / 100, currency)} outstanding`;
  }
  if (item.key === "followups") return "This month";
  return "Active right now";
}

export function OperationsSummary({
  items,
  currency,
  showDescription = true,
}: {
  items: OperationsSummaryItem[];
  currency: string;
  showDescription?: boolean;
}) {
  return (
    <section aria-labelledby="operations-heading" className="min-w-0">
      <div className="mb-3">
        <h2
          id="operations-heading"
          className="text-lg font-semibold tracking-tight text-neutral-950"
        >
          Today&apos;s operations
        </h2>
        {showDescription && (
          <p className="mt-0.5 text-sm text-neutral-600">
            A quick read on the work moving through your front desk.
          </p>
        )}
      </div>
      <Card className="grid min-w-0 grid-cols-1 gap-px overflow-hidden bg-neutral-200 shadow-none sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = OPERATION_ICON[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              className="group flex min-h-28 min-w-0 items-start gap-3 bg-white p-4 outline-none transition-colors duration-150 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/60 sm:p-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-neutral-600">
                  {item.label}
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-950">
                    {formatCount(item.value)}
                  </span>
                  <ArrowUpRight
                    className="h-4 w-4 text-neutral-300 transition-colors duration-150 group-hover:text-brand-600"
                    aria-hidden
                  />
                </span>
                <span className="mt-1 block text-xs leading-5 text-neutral-500">
                  {operationDetail(item, currency)}
                </span>
              </span>
            </Link>
          );
        })}
      </Card>
    </section>
  );
}

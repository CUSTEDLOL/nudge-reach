import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Mail,
  MessageSquareWarning,
  RefreshCw,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type {
  AttentionItem,
  AttentionQueue,
} from "@/modules/dashboard/stats";
import type { AttentionKind } from "@/modules/dashboard/workspace-profile";

const ATTENTION_ICON: Record<AttentionKind, LucideIcon> = {
  handoff: MessageSquareWarning,
  "owner-question": CircleHelp,
  unread: Mail,
  booking: CalendarClock,
  payment: CreditCard,
  followup: RefreshCw,
  setup: Settings2,
};

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = ATTENTION_ICON[item.kind];
  return (
    <li>
      <Link
        href={item.href}
        className="group/row flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors duration-150 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/60 sm:px-5"
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            item.urgent
              ? "bg-red-50 text-red-700"
              : "bg-neutral-100 text-neutral-600"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-neutral-950 sm:text-[15px]">
              {item.title}
            </span>
            {item.urgent && (
              <Badge tone="danger">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Urgent
              </Badge>
            )}
          </span>
          <span className="mt-0.5 block text-sm leading-5 text-neutral-600">
            {item.description}
          </span>
        </span>
        <span
          className="hidden shrink-0 items-center gap-2 text-sm font-medium text-brand-700 sm:flex"
          aria-hidden
        >
          Open
          <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover/row:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}

export function AttentionQueueSection({
  queue,
  showDescription = true,
}: {
  queue: AttentionQueue;
  showDescription?: boolean;
}) {
  return (
    <section aria-labelledby="attention-heading" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="attention-heading"
            className="text-lg font-semibold tracking-tight text-neutral-950"
          >
            Needs your attention
          </h2>
          {showDescription && (
            <p className="mt-0.5 text-sm text-neutral-600">
              The few things where a person can make the difference.
            </p>
          )}
        </div>
        {!queue.allClear && (
          <Badge tone={queue.items.some((item) => item.urgent) ? "danger" : "neutral"}>
            {queue.totalCount} area{queue.totalCount === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <Card className="overflow-hidden shadow-none">
        {queue.allClear ? (
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-neutral-950">
                  You&apos;re caught up
                </p>
                <p className="mt-0.5 text-sm leading-5 text-neutral-600">
                  No customer blockers are waiting. You can test the Front Desk
                  or keep an eye on new conversations.
                </p>
              </div>
            </div>
            <Link
              href="/inbox/try"
              className={buttonVariants({
                variant: "secondary",
                size: "sm",
                className: "w-full shrink-0 sm:w-auto",
              })}
            >
              Test the Front Desk
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-neutral-100">
              {queue.items.map((item) => (
                <AttentionRow key={item.kind} item={item} />
              ))}
            </ul>
            {queue.hiddenCount > 0 && queue.hiddenItems && (
              <details className="group border-t border-neutral-100">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 px-4 text-sm font-medium text-neutral-700 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/60 [&::-webkit-details-marker]:hidden">
                  View {queue.hiddenCount} more
                  <ChevronDown
                    className="h-4 w-4 transition-transform duration-150 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
                  {queue.hiddenItems.map((item) => (
                    <AttentionRow key={item.kind} item={item} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </Card>
    </section>
  );
}

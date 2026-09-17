"use client";

import Link from "next/link";
import { useTransition } from "react";
import { MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  STATUS_LABEL,
  STATUS_TONE,
  asBookingStatus,
  type BookingAction,
} from "@/modules/bookings";
import { setBookingStatusAction } from "./actions";

export interface BookingRow {
  id: string;
  name: string;
  /** The customer's contact name when it differs from the booking name. */
  contactName: string;
  phone: string;
  conversationId: string | null;
  /** "Fri 18 Sept, 4:00 pm" on the business's clock; null when only free text is known. */
  when: string | null;
  /** What the customer asked for, verbatim. */
  requestedFor: string;
  notes: string | null;
  partySize: number | null;
  status: string;
  actions: BookingAction[];
  /** A real calendar event exists for this booking. */
  inCalendar: boolean;
}

const ACTION_LABEL: Record<BookingAction, string> = {
  confirm: "Confirm",
  cancel: "Cancel",
  no_show: "No-show",
  complete: "Done",
};

export function BookingsList({ rows }: { rows: BookingRow[] }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const run = (bookingId: string, action: BookingAction) =>
    start(async () => {
      const fd = new FormData();
      fd.set("bookingId", bookingId);
      fd.set("action", action);
      const r = await setBookingStatusAction(fd);
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
    });

  return (
    <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
      {rows.map((b) => {
        const status = asBookingStatus(b.status);
        return (
          <li key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
            <div className="min-w-0 sm:w-44 sm:shrink-0">
              <p className="text-sm font-semibold text-neutral-950">
                {b.when ?? "Time to confirm"}
              </p>
              <p className="mt-0.5 truncate text-xs text-neutral-500" title={b.requestedFor}>
                asked for “{b.requestedFor}”
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">
                {b.name}
                {b.partySize ? ` · ${b.partySize} people` : ""}
              </p>
              <p className="mt-0.5 truncate text-xs text-neutral-500">
                {b.phone}
                {b.notes ? ` · ${b.notes}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
              {b.inCalendar && <Badge tone="info">In calendar</Badge>}
              {b.conversationId && (
                <Link
                  href={`/inbox/${b.conversationId}`}
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
                  Chat
                </Link>
              )}
              {b.actions.map((action) => (
                <Button
                  key={action}
                  size="sm"
                  variant={action === "confirm" ? "primary" : action === "cancel" ? "ghost" : "secondary"}
                  disabled={pending}
                  onClick={() => run(b.id, action)}
                >
                  {ACTION_LABEL[action]}
                </Button>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

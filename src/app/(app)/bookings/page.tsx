import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatInTimezone } from "@/lib/timezone";
import { requireOrgContext } from "@/modules/orgs/auth";
import { isSimulated } from "@/modules/orgs/mode";
import { getCalendarAccount } from "@/modules/calendar";
import { syncBookingsWithCalendar } from "@/modules/calendar/sync";
import {
  BOOKING_VIEWS,
  allowedActions,
  bookingBucket,
  type BookingView,
} from "@/modules/bookings";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { BookingsList, type BookingRow } from "./bookings-list";

export const metadata: Metadata = { title: "Bookings" };

const VIEW_LABEL: Record<BookingView, string> = {
  upcoming: "Upcoming",
  pending: "Needs confirming",
  past: "Past",
};

/**
 * Every appointment the AI took, in one place, on the business's clock.
 * Before this page a booking existed only as a count on Home and a line in
 * a chat — the founder's first practice booking looked like it had vanished.
 */
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, ctx] = await Promise.all([searchParams, requireOrgContext()]);
  const requested = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const view: BookingView = (BOOKING_VIEWS as readonly string[]).includes(requested ?? "")
    ? (requested as BookingView)
    : "upcoming";
  const now = new Date();
  const tz = ctx.org.timezone;

  const [rows, calendar] = await Promise.all([
    prisma.bookingRequest.findMany({
      where: { orgId: ctx.org.id },
      orderBy: [{ scheduledFor: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      take: 300,
      include: { contact: { select: { name: true, phoneE164: true } } },
    }),
    getCalendarAccount(ctx.org.id),
  ]);

  // Follow what the owner did in Google Calendar (moved, deleted) for the
  // bookings still ahead — bounded, and only for a real connection.
  const ahead = rows
    .filter((b) => bookingBucket(b, now) === "upcoming" && b.calendarEventId)
    .slice(0, 25);
  const synced = ahead.length ? await syncBookingsWithCalendar(ctx.org.id, ahead) : [];
  const syncedById = new Map(synced.map((b) => [b.id, b]));
  const current = rows.map((b) => ({ ...b, ...(syncedById.get(b.id) ?? {}) }));

  const counts: Record<BookingView, number> = { upcoming: 0, pending: 0, past: 0 };
  for (const b of current) counts[bookingBucket(b, now)]++;

  const list: BookingRow[] = current
    .filter((b) => bookingBucket(b, now) === view)
    .sort((a, b) => {
      const at = a.scheduledFor?.getTime() ?? 0;
      const bt = b.scheduledFor?.getTime() ?? 0;
      return view === "past" ? bt - at : at - bt;
    })
    .map((b) => ({
      id: b.id,
      name: b.name,
      contactName: b.contact.name,
      phone: b.contact.phoneE164,
      conversationId: b.conversationId,
      when: b.scheduledFor ? formatInTimezone(b.scheduledFor, tz) : null,
      requestedFor: b.requestedFor,
      notes: b.notes,
      partySize: b.partySize,
      status: b.status,
      actions: allowedActions(b, now),
      inCalendar: Boolean(b.calendarEventId) && Boolean(calendar) && !calendar?.simulated,
    }));

  const practice = isSimulated(ctx.org) || Boolean(calendar?.simulated);

  return (
    <section>
      <PageHeader
        title="Bookings"
        description={`Every appointment your AI has taken, shown in ${tz.replace("_", " ")} time.`}
        actions={
          practice ? (
            <Badge tone="info">Practice bookings</Badge>
          ) : calendar ? (
            <Badge tone="success">Synced with Google Calendar</Badge>
          ) : (
            <Link href="/integrations" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Connect a calendar
            </Link>
          )
        }
      />

      <nav aria-label="Booking lists" className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {BOOKING_VIEWS.map((v) => (
          <Link
            key={v}
            href={v === "upcoming" ? "/bookings" : `/bookings?view=${v}`}
            aria-current={v === view ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-400/60",
              v === view
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            )}
          >
            {VIEW_LABEL[v]}
            <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", v === view ? "bg-white/20" : "bg-neutral-100 text-neutral-500")}>
              {counts[v]}
            </span>
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="h-5 w-5" aria-hidden />}
          title={
            view === "pending"
              ? "Nothing to confirm"
              : view === "past"
                ? "No past bookings yet"
                : "No upcoming bookings"
          }
          description={
            view === "upcoming"
              ? "When a customer books through your AI, it lands here with the time, the name and a link to the chat."
              : view === "pending"
                ? "Requests the AI couldn't book straight into a calendar wait here for you to confirm."
                : "Finished, missed and cancelled appointments will show here."
          }
          action={
            view === "upcoming" ? (
              <Link href="/inbox/try" className={buttonVariants({ size: "sm" })}>
                Try booking as a customer
              </Link>
            ) : undefined
          }
        />
      ) : (
        <BookingsList rows={list} />
      )}
    </section>
  );
}

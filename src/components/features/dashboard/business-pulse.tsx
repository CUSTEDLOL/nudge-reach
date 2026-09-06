import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCount, formatMajorAmount } from "@/modules/dashboard/format";

export function BusinessPulse({
  bookingsThisMonth,
  leadsChasedThisMonth,
  revenueInfluenced,
  wonContacts,
  optedInContacts,
  totalContacts,
  currency,
}: {
  bookingsThisMonth: number;
  leadsChasedThisMonth: number;
  revenueInfluenced: number;
  wonContacts: number;
  optedInContacts: number;
  totalContacts: number;
  currency: string;
}) {
  const metrics = [
    {
      label: "Bookings",
      value: formatCount(bookingsThisMonth),
      hint: "Captured this month",
    },
    {
      label: "Leads chased",
      value: formatCount(leadsChasedThisMonth),
      hint: "Follow-ups sent this month",
    },
    {
      label: "Revenue influenced",
      value: formatMajorAmount(revenueInfluenced, currency),
      hint: `Estimated influence · ${formatCount(wonContacts)} won`,
    },
    {
      label: "Opted-in customers",
      value: formatCount(optedInContacts),
      hint: `${formatCount(totalContacts)} total contacts`,
    },
  ];

  return (
    <section aria-labelledby="business-pulse-heading" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="business-pulse-heading"
            className="text-lg font-semibold tracking-tight text-neutral-950"
          >
            Business pulse
          </h2>
          <p className="mt-0.5 text-sm text-neutral-600">
            Outcome signals for this month, without the reporting noise.
          </p>
        </div>
        <Link
          href="/analytics"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-700 outline-none hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-400/60"
        >
          Open analytics
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <Card className="grid grid-cols-1 gap-px overflow-hidden bg-neutral-200 shadow-none sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            data-pulse-metric="true"
            className="min-w-0 bg-white p-4 sm:p-5"
          >
            <p className="text-sm font-medium text-neutral-600">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-neutral-950">
              {metric.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {metric.hint}
            </p>
            {index === 0 && (
              <span className="mt-3 block h-1 w-8 rounded-full bg-brand-500" aria-hidden />
            )}
          </div>
        ))}
      </Card>
    </section>
  );
}

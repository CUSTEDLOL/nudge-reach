import type { Metadata } from "next";
import { Check, MessageSquare, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { formatInr, getMarketingRateInr } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "../section-header";

export const metadata: Metadata = { title: "Billing settings" };

const PLANS = [
  {
    name: "Starter",
    price: "₹999",
    blurb: "For a single shop getting started with WhatsApp marketing.",
    features: [
      "1,000 marketing messages / month",
      "1 connected WhatsApp number",
      "2 team seats",
      "AI campaign generation",
    ],
  },
  {
    name: "Growth",
    price: "₹2,499",
    blurb: "For growing retailers running weekly campaigns.",
    features: [
      "5,000 marketing messages / month",
      "AI agent auto-replies",
      "5 team seats",
      "Automations & segments",
    ],
    highlighted: true,
  },
  {
    name: "Scale",
    price: "₹6,999",
    blurb: "For multi-store brands and agencies.",
    features: [
      "25,000 marketing messages / month",
      "Unlimited team seats",
      "Priority support",
      "API access",
    ],
  },
];

export default async function BillingSettingsPage() {
  const { org } = await requireOrgContext();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(now);

  const [messageCount, costAgg, unpricedCount] = await Promise.all([
    prisma.message.count({
      where: { campaign: { orgId: org.id }, createdAt: { gte: monthStart } },
    }),
    prisma.message.aggregate({
      _sum: { costMinorUnits: true },
      where: {
        campaign: { orgId: org.id },
        createdAt: { gte: monthStart },
        costMinorUnits: { not: null },
      },
    }),
    prisma.message.count({
      where: {
        campaign: { orgId: org.id },
        createdAt: { gte: monthStart },
        costMinorUnits: null,
      },
    }),
  ]);

  const rateMinor = Math.round(getMarketingRateInr() * 100);
  const estCostMinor =
    (costAgg._sum.costMinorUnits ?? 0) + unpricedCount * rateMinor;
  const simulation = env.SEND_MODE === "simulation";

  return (
    <section className="flex flex-col gap-6">
      <div>
        <SectionHeader
          title="Billing"
          description="Your plan and this month's messaging usage."
        />
        <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-neutral-900">
                Current plan: Free
              </p>
              {simulation && <Badge tone="info">Simulation</Badge>}
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              Everything is included while Nudge is in early access
              {simulation ? " — sends are simulated at no cost" : ""}. Payments
              are coming soon.
            </p>
          </div>
          <Badge tone="neutral">Payments coming soon</Badge>
        </Card>
      </div>

      <div>
        <SectionHeader
          title={`Usage — ${monthLabel}`}
          description="Campaign messages sent this month and their estimated Meta cost."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Messages this month"
            value={messageCount.toLocaleString("en-IN")}
            icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            hint="campaign messages"
          />
          <StatCard
            label="Estimated cost"
            value={formatInr(estCostMinor)}
            icon={<Wallet className="h-4 w-4" aria-hidden />}
            hint={`estimate at ${formatInr(rateMinor)}/message`}
          />
        </div>
      </div>

      <div>
        <SectionHeader
          title="Plans"
          description="Pricing is indicative while payments are being wired up."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={
                "flex flex-col p-5" +
                (plan.highlighted ? " border-brand-200 ring-1 ring-brand-100" : "")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-neutral-900">
                  {plan.name}
                </p>
                {plan.highlighted && <Badge tone="brand">Popular</Badge>}
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
                {plan.price}
                <span className="text-sm font-normal text-neutral-400">
                  {" "}
                  / month
                </span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">{plan.blurb}</p>
              <ul className="mt-4 flex flex-col gap-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-neutral-600"
                  >
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600"
                      aria-hidden
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-5">
                <Badge tone="neutral">Coming soon</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

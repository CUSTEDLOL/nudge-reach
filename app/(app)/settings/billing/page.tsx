import type { Metadata } from "next";
import { Check, MessageSquare, Wallet, Users } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { formatInr, getMonthlyUsage } from "@/lib/billing";
import { PLANS, getPlan } from "@/lib/billing/plans";
import { isRazorpayConfigured } from "@/lib/billing/razorpay";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "../section-header";
import { PlanCheckout } from "./plan-checkout";

export const metadata: Metadata = { title: "Billing settings" };

export default async function BillingSettingsPage() {
  const { org, role } = await requireOrgContext();

  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const usage = await getMonthlyUsage(org.id);
  const currentPlan = getPlan(org.plan);
  const simulation = env.SEND_MODE === "simulation";
  const paymentsOn = isRazorpayConfigured();
  const canManage = role === "OWNER" || role === "ADMIN";

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
                Current plan: {currentPlan.name}
              </p>
              {org.subscriptionStatus === "active" ? (
                <Badge tone="success">Active</Badge>
              ) : (
                <Badge tone="neutral">Free</Badge>
              )}
              {simulation && <Badge tone="info">Simulation</Badge>}
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {currentPlan.tagline}
              {org.currentPeriodEnd && org.subscriptionStatus === "active"
                ? ` Renews ${new Intl.DateTimeFormat("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(org.currentPeriodEnd)}.`
                : ""}
            </p>
          </div>
          {!paymentsOn && (
            <Badge tone="neutral">Add Razorpay keys to enable payments</Badge>
          )}
        </Card>
      </div>

      <div>
        <SectionHeader
          title={`Usage — ${monthLabel}`}
          description="Campaign messages sent this month and their billable Meta cost."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <StatCard
            label="Messages this month"
            value={usage.messagesSent.toLocaleString("en-IN")}
            icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            hint="campaign messages"
          />
          <StatCard
            label="Message cost"
            value={formatInr(usage.costMinorUnits)}
            icon={<Wallet className="h-4 w-4" aria-hidden />}
            hint={simulation ? "estimated (simulation)" : "billed by Meta"}
          />
          <StatCard
            label="Contacts"
            value={usage.contacts.toLocaleString("en-IN")}
            icon={<Users className="h-4 w-4" aria-hidden />}
            hint={
              currentPlan.limits.contacts
                ? `of ${currentPlan.limits.contacts.toLocaleString("en-IN")} on ${currentPlan.name}`
                : "unlimited"
            }
          />
        </div>
      </div>

      <div>
        <SectionHeader
          title="Plans"
          description={
            paymentsOn
              ? "Upgrade any time — you're charged securely via Razorpay."
              : "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to turn on checkout."
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan.id;
            return (
              <Card
                key={plan.id}
                className={
                  "flex flex-col p-5" +
                  (plan.highlighted
                    ? " border-brand-200 ring-1 ring-brand-100"
                    : "")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-neutral-900">
                    {plan.name}
                  </p>
                  {plan.highlighted && <Badge tone="brand">Popular</Badge>}
                  {isCurrent && !plan.highlighted && (
                    <Badge tone="success">Current</Badge>
                  )}
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
                  {plan.priceInr === 0 ? "Free" : `₹${plan.priceInr.toLocaleString("en-IN")}`}
                  {plan.priceInr > 0 && (
                    <span className="text-sm font-normal text-neutral-400">
                      {" "}
                      / month
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{plan.tagline}</p>
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
                  {plan.id === "free" ? (
                    <span className="block text-center text-xs text-neutral-400">
                      {isCurrent ? "Your starting plan" : "—"}
                    </span>
                  ) : !canManage ? (
                    <span className="block text-center text-xs text-neutral-400">
                      Ask an admin to upgrade
                    </span>
                  ) : paymentsOn ? (
                    <PlanCheckout
                      planId={plan.id}
                      planName={plan.name}
                      current={isCurrent}
                      orgName={org.name}
                    />
                  ) : isCurrent ? (
                    <Badge tone="success">Current</Badge>
                  ) : (
                    <Badge tone="neutral">Payments off</Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

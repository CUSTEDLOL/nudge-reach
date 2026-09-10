import { notFound } from "next/navigation";
import { requireFounder } from "@/modules/admin/auth";
import { prisma } from "@/lib/db";
import { getPlan, PLANS } from "@/modules/billing/plans";
import { sanitizeFeatureOverrides } from "@/modules/billing/limits";
import { trialDaysLeft } from "@/modules/billing/trial";
import { SUBSCRIPTION_STATUSES } from "@/modules/admin/org-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionForm } from "@/components/features/admin-shell/action-form";
import {
  setFeatureOverridesAction,
  setLiveModeAction,
  setPlanAction,
  setSubscriptionStatusAction,
  setSuspendedAction,
  setTrialAction,
  setVoiceMinutesAction,
} from "../actions";

const inputCls =
  "h-9 rounded-lg border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-neutral-500";

const FLAGS = [
  ["aiFrontDesk", "AI Front Desk (booking, follow-ups, actions)"],
  ["publicApi", "Developer API + webhooks"],
  ["customActions", "Custom agent actions"],
  ["byoLlm", "Bring-your-own LLM key"],
  ["multiNumber", "Multiple WhatsApp numbers"],
  ["webWidget", "Website widget"],
  ["leadScoring", "Lead scoring"],
  ["voiceAgent", "Voice front desk"],
] as const;
const COUNTS = [
  ["contacts", "Contacts"],
  ["teamMembers", "Team members"],
  ["automations", "Automations"],
  ["messagesPerMonth", "Campaign messages / month"],
] as const;

/** Every lever a founder has over one org's plan, trial, mode and access. */
export default async function AdminOrgControlsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFounder();
  const { id } = await params;
  const org = await prisma.org.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      plan: true,
      simulated: true,
      suspendedAt: true,
      trialEndsAt: true,
      subscriptionStatus: true,
      voiceMinutesOverride: true,
      featureOverrides: true,
      _count: { select: { whatsappAccounts: true } },
    },
  });
  if (!org) notFound();

  const plan = getPlan(org.plan);
  const overrides = sanitizeFeatureOverrides(org.featureOverrides) as Record<string, unknown>;
  const trialLeft = trialDaysLeft(org.trialEndsAt);
  const hidden = { orgId: org.id };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            Currently <span className="font-medium text-neutral-900">{plan.name}</span>. Changing the plan
            changes every limit at once; use overrides below for one-off exceptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={setPlanAction}
            hidden={hidden}
            submitLabel="Change plan"
            confirm={{ title: "Change this org's plan?", description: "The new limits apply immediately." }}
            askReason
            className="flex flex-wrap items-center gap-2"
          >
            <select name="plan" defaultValue={org.plan} className={inputCls} aria-label="Plan">
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trial</CardTitle>
          <CardDescription>
            {trialLeft === null
              ? "No trial running."
              : trialLeft === 0
                ? "Trial has ended (the nightly cron drops them to Free unless a subscription is active)."
                : `${trialLeft} day${trialLeft === 1 ? "" : "s"} left.`}{" "}
            Set a new length from today, or 0 to clear.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={setTrialAction}
            hidden={hidden}
            submitLabel="Set trial"
            confirm={{ title: "Change the trial?" }}
            askReason
            className="flex flex-wrap items-center gap-2"
          >
            <input
              name="days"
              type="number"
              min={0}
              max={180}
              defaultValue={trialLeft ?? 14}
              className={`${inputCls} w-24`}
              aria-label="Trial days from today"
            />
            <span className="text-sm text-neutral-500">days from today</span>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription status</CardTitle>
          <CardDescription>
            Currently <span className="font-medium text-neutral-900">{org.subscriptionStatus.replace("_", " ")}</span>.
            Razorpay/Stripe webhooks set this automatically; override for comped, offline-paid or cancelled deals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={setSubscriptionStatusAction}
            hidden={hidden}
            submitLabel="Update status"
            confirm={{ title: "Change the subscription status?" }}
            askReason
            className="flex flex-wrap items-center gap-2"
          >
            <select name="status" defaultValue={org.subscriptionStatus} className={inputCls} aria-label="Subscription status">
              {SUBSCRIPTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live / test mode</CardTitle>
          <CardDescription>
            {org.simulated
              ? "In test mode: every send is simulated, nothing reaches Meta."
              : "Live: sends go through the org's connected WhatsApp number."}{" "}
            {org._count.whatsappAccounts === 0 && "No number connected yet, so going live is blocked."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={setLiveModeAction}
            hidden={{ ...hidden, live: org.simulated ? "true" : "false" }}
            submitLabel={org.simulated ? "Switch to live" : "Back to test mode"}
            variant={org.simulated ? "primary" : "secondary"}
            disabled={org.simulated && org._count.whatsappAccounts === 0}
            confirm={{
              title: org.simulated ? "Take this workspace live?" : "Put this workspace back in test mode?",
              description: org.simulated
                ? "Real messages will be sent to real customers from now on."
                : "Sends will be simulated until it is switched back.",
              danger: org.simulated,
            }}
            askReason
            confirmText={{ expected: org.name, label: `Type “${org.name}” to confirm` }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Call minutes</CardTitle>
          <CardDescription>
            Plan includes{" "}
            {plan.limits.voiceMinutesPerMonth === null
              ? "unlimited"
              : plan.limits.voiceMinutesPerMonth}{" "}
            minutes/month.{" "}
            {org.voiceMinutesOverride !== null
              ? `Override in place: ${org.voiceMinutesOverride}.`
              : "No override."}{" "}
            Leave blank to use the plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={setVoiceMinutesAction}
            hidden={hidden}
            submitLabel="Save minutes"
            confirm={{ title: "Change the call-minute allowance?" }}
            askReason
            className="flex flex-wrap items-center gap-2"
          >
            <input
              name="minutes"
              type="number"
              min={0}
              max={100000}
              defaultValue={org.voiceMinutesOverride ?? ""}
              placeholder="plan"
              className={`${inputCls} w-28`}
              aria-label="Minutes per month"
            />
            <span className="text-sm text-neutral-500">minutes / month</span>
          </ActionForm>
        </CardContent>
      </Card>

      <Card className={org.suspendedAt ? "border-red-200" : ""}>
        <CardHeader>
          <CardTitle>{org.suspendedAt ? "Suspended" : "Suspend workspace"}</CardTitle>
          <CardDescription>
            {org.suspendedAt
              ? `Suspended since ${org.suspendedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}. Members see a locked page and every outbound message is refused.`
              : "Locks the app for every member and refuses every outbound message (agent, campaigns, follow-ups). Data is kept. Reversible."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={setSuspendedAction}
            hidden={{ ...hidden, suspended: org.suspendedAt ? "false" : "true" }}
            submitLabel={org.suspendedAt ? "Lift suspension" : "Suspend"}
            variant={org.suspendedAt ? "primary" : "danger"}
            confirm={{
              title: org.suspendedAt ? "Lift the suspension?" : `Suspend ${org.name}?`,
              description: org.suspendedAt
                ? "Members regain access and sends resume immediately."
                : "A reason is required; it is written to the org's audit log.",
              danger: !org.suspendedAt,
            }}
            askReason
            confirmText={{ expected: org.name, label: `Type “${org.name}” to confirm` }}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Feature overrides</CardTitle>
          <CardDescription>
            Bespoke deals without a new plan. Each field inherits from{" "}
            <span className="font-medium text-neutral-900">{plan.name}</span> unless set here. Enforced in the
            same server-side gates the plan uses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={setFeatureOverridesAction}
            hidden={hidden}
            submitLabel="Save overrides"
            confirm={{ title: "Save feature overrides?", description: "They take effect on the next request." }}
            askReason
            className="space-y-4"
          >
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {FLAGS.map(([key, label]) => {
                const planValue = plan.limits[key] ? "on" : "off";
                const current = overrides[key];
                return (
                  <label key={key} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {label}
                      <span className="ml-1 text-xs text-neutral-400">plan: {planValue}</span>
                    </span>
                    <select
                      name={`ov.${key}`}
                      defaultValue={current === true ? "on" : current === false ? "off" : ""}
                      className={`${inputCls} w-28`}
                    >
                      <option value="">inherit</option>
                      <option value="on">on</option>
                      <option value="off">off</option>
                    </select>
                  </label>
                );
              })}
            </div>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {COUNTS.map(([key, label]) => {
                const planValue = plan.limits[key];
                const current = overrides[key];
                return (
                  <label key={key} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {label}
                      <span className="ml-1 text-xs text-neutral-400">
                        plan: {planValue === null ? "unlimited" : planValue}
                      </span>
                    </span>
                    <input
                      name={`ov.${key}`}
                      defaultValue={current === null ? "unlimited" : typeof current === "number" ? String(current) : ""}
                      placeholder="inherit"
                      className={`${inputCls} w-28`}
                      aria-label={`${label} override (number or "unlimited")`}
                    />
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-neutral-400">
              Counts accept a number or the word <span className="font-mono">unlimited</span>; blank inherits.
            </p>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}

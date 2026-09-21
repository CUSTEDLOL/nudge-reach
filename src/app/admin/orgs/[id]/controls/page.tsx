import { notFound } from "next/navigation";
import { requireFounder } from "@/modules/admin/auth";
import { prisma } from "@/lib/db";
import { getPlan, PLANS } from "@/modules/billing/plans";
import { sanitizeFeatureOverrides } from "@/modules/billing/limits";
import { trialDaysLeft } from "@/modules/billing/trial";
import { microUsdToCredits } from "@/modules/billing/credit-rates";
import {
  DEFAULT_FOUNDER_GRANT_DAYS,
  MAX_FOUNDER_CREDITS,
  MAX_FOUNDER_GRANT_DAYS,
  orgCreditSummary,
} from "@/modules/billing/credit-admin";
import { SUBSCRIPTION_STATUSES } from "@/modules/admin/org-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm } from "@/components/features/admin-shell/action-form";
import {
  grantCreditsAction,
  setFeatureOverridesAction,
  setIncludedCreditsOverrideAction,
  setLiveModeAction,
  setPlanAction,
  setSubscriptionStatusAction,
  setSuspendedAction,
  setTrialAction,
  setVoiceMinutesAction,
} from "../actions";

const inputCls =
  "h-9 rounded-lg border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-neutral-500";

/** Micro-USD → credits with one decimal, for the credit card. */
const fmtCredits = (micro: number) =>
  microUsdToCredits(micro).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const FLAGS = [
  ["aiFrontDesk", "Real actions (booking, payment links, follow-ups)"],
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
  ["whatsappNumbers", "WhatsApp numbers"],
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
      currentPeriodEnd: true,
      voiceMinutesOverride: true,
      includedCreditsOverride: true,
      featureOverrides: true,
      _count: { select: { whatsappAccounts: true } },
    },
  });
  if (!org) notFound();
  const credits = await orgCreditSummary(org.id);

  const plan = getPlan(org.plan);
  const enterpriseWithoutAmount = plan.contactOnly && org.includedCreditsOverride === null;
  const overrides = sanitizeFeatureOverrides(org.featureOverrides) as Record<string, unknown>;
  const trialLeft = trialDaysLeft(org.trialEndsAt);
  const hidden = { orgId: org.id };
  // Going LIVE needs a connected number (org-controls.ts refuses otherwise);
  // going back to test mode never does, so don't over-block the button.
  const blockedFromLive = org.simulated && org._count.whatsappAccounts === 0;

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
            Currently <span className="font-medium text-neutral-900">{org.subscriptionStatus.replace("_", " ")}</span>
            {org.currentPeriodEnd
              ? org.currentPeriodEnd > new Date()
                ? `, paid to ${org.currentPeriodEnd.toISOString().slice(0, 10)}.`
                : `. The paid month ended ${org.currentPeriodEnd.toISOString().slice(0, 10)}, so the AI has no credits: choose "active" again to start the next month.`
              : ". No paid period yet, so the AI has no credits: choose \"active\" to start a month."}{" "}
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
            {blockedFromLive
              ? "Connect this workspace’s WhatsApp number on the Integrations tab first — going live is blocked until then. Switching back to test mode never is."
              : "You can switch back and forth; only going live needs a connected number."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/*
            The button is disabled, and a disabled control swallows pointer
            events — so a `title` on it would never fire. The explanation hangs
            off a wrapper instead, and is repeated as plain text above for
            anyone who never hovers (keyboard, touch, screen reader).
          */}
          <span className="group relative inline-block">
            {blockedFromLive && (
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-72 rounded-lg bg-neutral-900 px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
              >
                No WhatsApp number connected. A live workspace needs credentials
                to send, so connect the number on the <b>Integrations</b> tab —
                then this button turns on.
              </span>
            )}
            <ActionForm
              action={setLiveModeAction}
              hidden={{ ...hidden, live: org.simulated ? "true" : "false" }}
              submitLabel={org.simulated ? "Switch to live" : "Back to test mode"}
              variant={org.simulated ? "primary" : "secondary"}
              disabled={blockedFromLive}
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
          </span>
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

      <Card className={`lg:col-span-2 ${enterpriseWithoutAmount ? "border-amber-200" : ""}`}>
        <CardHeader>
          <CardTitle>AI credits</CardTitle>
          <CardDescription>
            Balance <span className="font-medium text-neutral-900">{fmtCredits(credits.balanceMicroUsd)} credits</span>.{" "}
            {plan.contactOnly
              ? org.includedCreditsOverride === null
                ? "Enterprise: no included amount set."
                : `Enterprise: ${org.includedCreditsOverride} included credits per paid period.`
              : `${plan.name} includes ${plan.includedCredits ?? "no"} credits per paid period.`}{" "}
            Purchased and founder credits are spent soonest-expiring first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {enterpriseWithoutAmount && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Enterprise with no included-credits amount: AI is paused until one is set.
            </p>
          )}

          {credits.grants.length === 0 ? (
            <p className="text-sm text-neutral-500">No unexpired credit grants.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-100">
              <Table>
                <TableHeader>
                  <TableRow className="border-t-0 hover:bg-transparent">
                    <TableHead>Kind</TableHead>
                    <TableHead className="text-right">Remaining / issued</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credits.grants.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="capitalize">{g.kind}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtCredits(g.remainingMicroUsd)} / {fmtCredits(g.amountMicroUsd)}
                      </TableCell>
                      <TableCell className="tabular-nums">{g.expiresAt.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="text-neutral-500">{g.note ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-900">Grant credits</p>
              <ActionForm
                action={grantCreditsAction}
                hidden={hidden}
                submitLabel="Grant"
                confirm={{ title: "Grant AI credits?", description: "Written to the org's audit log with your reason." }}
                askReason
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  name="credits"
                  type="number"
                  min={1}
                  max={MAX_FOUNDER_CREDITS}
                  placeholder="credits"
                  className={`${inputCls} w-28`}
                  aria-label="Credits to grant"
                />
                <input
                  name="expiresInDays"
                  type="number"
                  min={1}
                  max={MAX_FOUNDER_GRANT_DAYS}
                  placeholder={String(DEFAULT_FOUNDER_GRANT_DAYS)}
                  className={`${inputCls} w-24`}
                  aria-label="Expires in days"
                />
                <span className="text-sm text-neutral-500">days</span>
              </ActionForm>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-900">Included credits (Enterprise)</p>
              <ActionForm
                action={setIncludedCreditsOverrideAction}
                hidden={hidden}
                submitLabel="Save amount"
                confirm={{
                  title: "Change the included credits?",
                  description: "Applies to this period immediately and to every period after.",
                }}
                askReason
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  name="credits"
                  type="number"
                  min={0}
                  max={MAX_FOUNDER_CREDITS}
                  defaultValue={org.includedCreditsOverride ?? ""}
                  placeholder="none"
                  className={`${inputCls} w-28`}
                  aria-label="Included credits per period"
                />
                <span className="text-sm text-neutral-500">credits / period · blank clears</span>
              </ActionForm>
            </div>
          </div>
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

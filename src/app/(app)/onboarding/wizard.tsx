"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { VERTICALS } from "@/modules/dashboard/verticals";
import { COUNTRY_PRESETS } from "@/modules/billing/money";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  completeOnboardingAction,
  saveBusinessProfileAction,
  type ActionResult,
} from "./actions";

const STEPS = [
  { n: 1, label: "Your business" },
  { n: 2, label: "WhatsApp" },
  { n: 3, label: "Contacts" },
] as const;

export interface WizardProps {
  orgName: string;
  vertical: string | null;
  /** COUNTRY_PRESETS code derived from the org's dial code ("" if custom). */
  country: string;
  whatsappConnected: boolean;
  whatsappDisplayName: string | null;
  simulationMode: boolean;
  contactCount: number;
}

export function OnboardingWizard(props: WizardProps) {
  const [step, setStep] = useState(1);
  const { toast } = useToast();

  const [, profileAction, profilePending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await saveBusinessProfileAction(formData);
      if (result.ok) {
        setStep(2);
      } else {
        toast({ description: result.message, tone: "error" });
      }
      return result;
    },
    null
  );

  const [, finishAction, finishPending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      // Redirects to /dashboard or /contacts on success.
      const result = await completeOnboardingAction(formData);
      if (!result.ok) toast({ description: result.message, tone: "error" });
      return result;
    },
    null
  );

  // Skipping = completing with next=dashboard (sets onboardedAt either way);
  // a separate useActionState keeps its pending state independent.
  const [, skipAction, skipPending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await completeOnboardingAction(formData);
      if (!result.ok) toast({ description: result.message, tone: "error" });
      return result;
    },
    null
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <h1 className="text-xl font-semibold text-neutral-900">
              Welcome to Nudge
            </h1>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Three quick steps and your AI Front Desk is on shift.
          </p>
        </div>
        <form action={skipAction}>
          <input type="hidden" name="next" value="dashboard" />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            loading={skipPending}
            className="whitespace-nowrap"
          >
            Skip for now
          </Button>
        </form>
      </div>

      <StepIndicator current={step} />

      {step === 1 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-neutral-900">
            Tell us about your business
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Your AI employee introduces itself as this business and answers in
            its name.
          </p>
          <form action={profileAction} className="mt-5 flex flex-col gap-4">
            <div>
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                name="businessName"
                defaultValue={props.orgName}
                placeholder="Meera's Boutique"
                required
                minLength={2}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="vertical">What kind of business is it?</Label>
              <Select
                id="vertical"
                name="vertical"
                defaultValue={props.vertical ?? ""}
                required
                className="mt-1.5"
              >
                <option value="" disabled>
                  Pick the closest match…
                </option>
                {VERTICALS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="country">Where is your business?</Label>
              <Select
                id="country"
                name="country"
                defaultValue={props.country || "IN"}
                required
                className="mt-1.5"
              >
                {COUNTRY_PRESETS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label} ({c.dialCode} · bills in {c.currency})
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-neutral-400">
                Sets your phone country code, currency and timezone — you can
                change it later in Settings.
              </p>
            </div>
            <div className="mt-1 flex justify-end">
              <Button type="submit" loading={profilePending}>
                Continue
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-neutral-900">
            Connect WhatsApp
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Nudge sends over the official WhatsApp Cloud API — no bots, no
            number bans.
          </p>

          <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            {props.whatsappConnected ? (
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900">
                      {props.whatsappDisplayName ?? "Your number"}
                    </p>
                    <Badge tone="success">Connected</Badge>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    Your WhatsApp Business number is linked and ready to send.
                  </p>
                </div>
              </div>
            ) : props.simulationMode ? (
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900">
                      Test mode until your number is live
                    </p>
                    <Badge tone="info">Test mode</Badge>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    Explore everything now — nothing reaches real customers
                    until we connect your number on the setup call.
                  </p>
                  <Link
                    href="/settings/whatsapp"
                    className={buttonVariants({
                      variant: "secondary",
                      size: "sm",
                      className: "mt-3",
                    })}
                  >
                    Connect a real number
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900">
                      No number connected yet
                    </p>
                    <Badge tone="warning">Not connected</Badge>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    Link your WhatsApp Business Account to send for real. You
                    can finish setup first and connect later.
                  </p>
                  <Link
                    href="/settings/whatsapp"
                    className={buttonVariants({
                      size: "sm",
                      className: "mt-3",
                    })}
                  >
                    Connect WhatsApp
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>
            <Button type="button" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-neutral-900">
            Bring in your customers
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {props.contactCount > 0
              ? `You already have ${props.contactCount} contact${
                  props.contactCount === 1 ? "" : "s"
                } — add the rest whenever you like.`
              : "Import a CSV or add customers one by one from the Contacts page."}
          </p>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-900">
                Consent matters:
              </span>{" "}
              only import customers who agreed to hear from you on WhatsApp.
              Nudge only ever sends marketing to opted-in contacts — opt-outs
              are honored permanently.
            </p>
          </div>

          <form action={finishAction} className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(2)}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  name="next"
                  value="dashboard"
                  variant="secondary"
                  loading={finishPending}
                >
                  Go to dashboard
                </Button>
                <Button
                  type="submit"
                  name="next"
                  value="contacts"
                  loading={finishPending}
                >
                  <Users className="h-4 w-4" aria-hidden />
                  Finish &amp; import contacts
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol aria-label="Setup steps" className="flex items-center gap-2">
      {STEPS.map((s, index) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <li key={s.n} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-150",
                done && "bg-emerald-100 text-emerald-700",
                active && "bg-brand-600 text-white",
                !done && !active && "bg-neutral-100 text-neutral-500"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : s.n}
            </span>
            <span
              className={cn(
                "text-sm",
                active
                  ? "font-medium text-neutral-900"
                  : "text-neutral-500"
              )}
            >
              {s.label}
            </span>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1",
                  done ? "bg-emerald-200" : "bg-neutral-200"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

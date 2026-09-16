"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  CreditCard,
  MessageSquareText,
  Plug,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { VERTICALS } from "@/modules/dashboard/verticals";
import { COUNTRY_PRESETS } from "@/modules/billing/money";
import {
  OUTCOME_OPTIONS,
  deriveWorkspaceDefaults,
  type PrimaryOutcome,
  type UiPreferences,
  type WorkspaceProfile,
  type WorkspaceProfilePatch,
} from "@/modules/dashboard/workspace-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  completeOnboardingAction,
  saveBusinessProfileAction,
  saveWorkspaceProfileStepAction,
  type ActionResult,
} from "./actions";
import { visibleChoiceValue } from "./question-state";

/**
 * Two questions, then the summary. The five discovery questions that used to
 * sit in front of these were cut: they only fed shortcut/ordering cosmetics,
 * and one ("what do you use today?") fed nothing that ships. The goal answer
 * now earns its place by ordering the attention queue on Home.
 */
const QUESTION_COUNT = 2;
const SUMMARY_STEP = 3;

/** Each task carries the `next` value that finishes setup and lands there. */
const SETUP_TASKS = {
  "teach-front-desk": {
    label: "Teach your Front Desk",
    description: "Add the facts it needs to answer like your best employee.",
    icon: Bot,
    next: "knowledge",
  },
  "try-front-desk": {
    label: "Try a customer conversation",
    description: "See how it responds safely in your test workspace.",
    icon: MessageSquareText,
    next: "try",
  },
  "connect-whatsapp": {
    label: "Connect WhatsApp",
    description: "Link your official business number when you are ready.",
    icon: Plug,
    next: "whatsapp",
  },
  "connect-calendar": {
    label: "Connect your calendar",
    description: "Let Nudge book against your real availability.",
    icon: CalendarDays,
    next: "apps",
  },
  "import-contacts": {
    label: "Bring in opted-in customers",
    description: "Import only people who agreed to hear from you.",
    icon: Users,
    next: "contacts",
  },
  "configure-followups": {
    label: "Review your follow-up plan",
    description: "Confirm how Nudge should chase quiet leads and bookings.",
    icon: ArrowRight,
    next: "followups",
  },
} as const;

/** One glyph per priority, so the first question reads at a glance. */
const OUTCOME_ICONS: Record<string, typeof Bot> = {
  bookings: CalendarDays,
  "faster-responses": Zap,
  "follow-up": RefreshCw,
  "fewer-no-shows": ShieldCheck,
  payments: CreditCard,
  support: CircleHelp,
};

type Choice = {
  value: string;
  label: string;
  description?: string;
};

export interface WizardProps {
  orgName: string;
  vertical: string | null;
  country: string;
  whatsappConnected: boolean;
  whatsappDisplayName: string | null;
  simulationMode: boolean;
  contactCount: number;
  initialProfile: WorkspaceProfile;
  initialUiPreferences: UiPreferences;
  customizing: boolean;
}

export function OnboardingWizard(props: WizardProps) {
  const initialStep = props.customizing
    ? 1
    : Math.min(
        Math.max(props.initialProfile.lastCompletedStep + 1, 1),
        SUMMARY_STEP
      );
  const [step, setStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [profile, setProfile] = useState(props.initialProfile);
  const [businessName, setBusinessName] = useState(props.orgName);
  const [vertical, setVertical] = useState(props.vertical ?? "");
  const [country, setCountry] = useState(props.country || "IN");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [, finishAction, finishPending] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => {
      const result = await completeOnboardingAction(formData);
      if (!result.ok) setError(result.message);
      return result;
    },
    null
  );
  const [, skipAction, skipPending] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => {
      const result = await completeOnboardingAction(formData);
      if (!result.ok) setError(result.message);
      return result;
    },
    null
  );

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  function goBack() {
    setError(null);
    setDirection(-1);
    setStep((current) => Math.max(1, current - 1));
  }

  function saveAndAdvance(patch: WorkspaceProfilePatch, nextStep: number) {
    setError(null);
    setProfile((current) => ({ ...current, ...patch }));
    startSaving(() => {
      void (async () => {
        const result = await saveWorkspaceProfileStepAction(patch);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        if (result.profile) setProfile(result.profile);
        setDirection(1);
        setStep(nextStep);
      })();
    });
  }

  async function saveBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startSaving(() => {
      void (async () => {
        const businessResult = await saveBusinessProfileAction(formData);
        if (!businessResult.ok) {
          setError(businessResult.message);
          return;
        }
        const profileResult = await saveWorkspaceProfileStepAction({
          lastCompletedStep: 2,
        });
        if (!profileResult.ok) {
          setError(profileResult.message);
          return;
        }
        if (profileResult.profile) setProfile(profileResult.profile);
        setDirection(1);
        setStep(SUMMARY_STEP);
      })();
    });
  }

  const visibleProgress = Math.min(step, QUESTION_COUNT);
  const progress = (visibleProgress / QUESTION_COUNT) * 100;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col py-2 sm:py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-700">
            {props.customizing ? "Customize workspace" : "Set up your workspace"}
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            {step === SUMMARY_STEP
              ? "Your recommendations are ready"
              : `Question ${visibleProgress} of ${QUESTION_COUNT}`}
          </p>
        </div>
        <form action={skipAction}>
          <input type="hidden" name="next" value="dashboard" />
          <Button
            type="submit"
            variant="ghost"
            loading={skipPending}
            className="min-h-11 whitespace-nowrap"
          >
            {props.customizing ? "Back to Today" : "Skip for now"}
          </Button>
        </form>
      </div>

      <div
        role="progressbar"
        aria-label="Workspace setup progress"
        aria-valuemin={1}
        aria-valuemax={QUESTION_COUNT}
        aria-valuenow={visibleProgress}
        className="mb-8 h-1.5 overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="relative min-h-[31rem]">
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.section
            key={step}
            custom={direction}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: direction > 0 ? 24 : -24 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: direction > 0 ? -16 : 16 }
            }
            transition={{ duration: reduceMotion ? 0.08 : 0.2, ease: "easeOut" }}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8"
          >
            {step === 1 && (
              <QuestionFrame
                headingRef={headingRef}
                eyebrow="Your priority"
                title="What should Nudge improve first?"
                description="This decides which exceptions Nudge puts in front of you first on Home."
              >
                <ChoiceCards
                  options={OUTCOME_OPTIONS}
                  value={visibleChoiceValue(
                    profile.primaryOutcome,
                    1,
                    profile.lastCompletedStep
                  )}
                  disabled={saving}
                  onSelect={(value) =>
                    saveAndAdvance(
                      {
                        primaryOutcome: value as PrimaryOutcome,
                        lastCompletedStep: 1,
                      },
                      2
                    )
                  }
                />
                <ChoiceBackControl
                  onBack={goBack}
                  pending={saving}
                  disabled={step === 1}
                />
              </QuestionFrame>
            )}

            {step === 2 && (
              <QuestionFrame
                headingRef={headingRef}
                eyebrow="Your business"
                title="What should your Front Desk represent?"
                description="These basics set the business identity, timezone, and billing currency."
              >
                <form onSubmit={saveBusiness} className="space-y-4">
                  <div>
                    <Label htmlFor="businessName">Business name</Label>
                    <Input
                      id="businessName"
                      name="businessName"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      placeholder="Aster Skin Clinic"
                      required
                      minLength={2}
                      className="mt-1.5 h-11 text-base"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vertical">Type of business</Label>
                    <Select
                      id="vertical"
                      name="vertical"
                      value={vertical}
                      onChange={(event) => setVertical(event.target.value)}
                      required
                      className="mt-1.5 h-11 text-base"
                    >
                      <option value="" disabled>
                        Pick the closest match…
                      </option>
                      {VERTICALS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="country">Business location</Label>
                    <Select
                      id="country"
                      name="country"
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      required
                      className="mt-1.5 h-11 text-base"
                    >
                      {COUNTRY_PRESETS.map((preset) => (
                        <option key={preset.code} value={preset.code}>
                          {preset.label} ({preset.dialCode} · {preset.currency})
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                      You can change these workspace settings later.
                    </p>
                  </div>
                  <QuestionFooter
                    onBack={goBack}
                    pending={saving}
                    submit
                  />
                </form>
              </QuestionFrame>
            )}

            {step === SUMMARY_STEP && (
              <RecommendationSummary
                headingRef={headingRef}
                profile={profile}
                businessName={businessName}
                simulationMode={props.simulationMode}
                whatsappConnected={props.whatsappConnected}
                contactCount={props.contactCount}
                onBack={goBack}
                finishAction={finishAction}
                finishPending={finishPending}
              />
            )}

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error} Your selection is still here—try again.</span>
              </div>
            )}
            {saving && (
              <p aria-live="polite" className="mt-4 text-center text-sm text-neutral-500">
                Saving your answer…
              </p>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}

function QuestionFrame({
  headingRef,
  eyebrow,
  title,
  description,
  children,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <p className="text-sm font-semibold text-brand-700">{eyebrow}</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 max-w-2xl text-2xl font-semibold tracking-[-0.025em] text-neutral-950 outline-none sm:text-3xl"
      >
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-neutral-600">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </>
  );
}

function ChoiceCards({
  options,
  value,
  onSelect,
  disabled,
}: {
  options: readonly Choice[];
  value: string;
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const selected = value === option.value;
        const Icon = OUTCOME_ICONS[option.value];
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onSelect(option.value)}
            className={cn(
              "group flex min-h-24 items-start gap-3.5 rounded-2xl border p-4 text-left outline-none transition-all duration-150 disabled:opacity-60",
              selected
                ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50",
              "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            )}
          >
            {Icon && (
              <span
                aria-hidden
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-150",
                  selected
                    ? "bg-brand-600 text-white"
                    : "bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-neutral-900">
                {option.label}
              </span>
              {option.description && (
                <span className="mt-1 block text-sm leading-relaxed text-neutral-500">
                  {option.description}
                </span>
              )}
            </span>
            <SelectionMark selected={selected} />
          </button>
        );
      })}
    </div>
  );
}

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border",
        selected
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-neutral-300 bg-white"
      )}
      aria-hidden
    >
      {selected && <Check className="h-3 w-3" />}
    </span>
  );
}

function ChoiceBackControl({
  onBack,
  pending,
  disabled = false,
}: {
  onBack: () => void;
  pending: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6 border-t border-neutral-100 pt-5">
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={pending || disabled}
        className="min-h-11"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Button>
    </div>
  );
}

function QuestionFooter({
  onBack,
  onNext,
  pending,
  nextDisabled = false,
  submit = false,
}: {
  onBack: () => void;
  onNext?: () => void;
  pending: boolean;
  nextDisabled?: boolean;
  submit?: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-neutral-100 pt-5">
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={pending}
        className="min-h-11"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Button>
      <Button
        type={submit ? "submit" : "button"}
        onClick={submit ? undefined : onNext}
        loading={pending}
        disabled={nextDisabled}
        className="min-h-11"
      >
        Continue
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

function RecommendationSummary({
  headingRef,
  profile,
  businessName,
  simulationMode,
  whatsappConnected,
  contactCount,
  onBack,
  finishAction,
  finishPending,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  profile: WorkspaceProfile;
  businessName: string;
  simulationMode: boolean;
  whatsappConnected: boolean;
  contactCount: number;
  onBack: () => void;
  finishAction: (formData: FormData) => void;
  finishPending: boolean;
}) {
  const defaults = deriveWorkspaceDefaults(profile);
  const outcome = OUTCOME_OPTIONS.find(
    (option) => option.value === profile.primaryOutcome
  );

  const plan = defaults.setupOrder.slice(0, 4);
  const first = SETUP_TASKS[plan[0]];

  return (
    <>
      <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-100 text-brand-700">
        <CheckCircle2 className="h-5 w-5" aria-hidden />
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 text-2xl font-semibold tracking-[-0.025em] text-neutral-950 outline-none sm:text-3xl"
      >
        {businessName || "Your workspace"} is ready
      </h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-neutral-600">
        We’ll start by helping you{" "}
        {outcome?.label.toLowerCase() ?? "run the front desk"}. Pick where to
        begin — you can do the rest whenever you like.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <StatusChip
          done={whatsappConnected || simulationMode}
          label={
            whatsappConnected
              ? "WhatsApp connected"
              : simulationMode
                ? "Safe test workspace"
                : "WhatsApp ready to connect"
          }
        />
        <StatusChip
          done={contactCount > 0}
          label={
            contactCount > 0
              ? `${contactCount} customer${contactCount === 1 ? "" : "s"} ready`
              : "No customers imported yet"
          }
        />
      </div>

      {/* Each step finishes setup and drops them straight into that screen. */}
      <ol className="mt-6 flex flex-col gap-2.5">
        {plan.map((task, index) => {
          const item = SETUP_TASKS[task];
          const Icon = item.icon;
          const primary = index === 0;
          return (
            <li key={task}>
              <form action={finishAction}>
                <input type="hidden" name="next" value={item.next} />
                <button
                  type="submit"
                  disabled={finishPending}
                  className={cn(
                    "group flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left outline-none transition-colors duration-150 disabled:opacity-60",
                    primary
                      ? "border-brand-500 bg-brand-50/60 hover:bg-brand-50"
                      : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50",
                    "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      primary
                        ? "bg-brand-600 text-white"
                        : "bg-neutral-100 text-neutral-600"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-neutral-950">
                        {item.label}
                      </span>
                      {primary && (
                        <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                          Start here
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-neutral-500">
                      {item.description}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </button>
              </form>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 rounded-xl bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-900">
        Nothing operational has been switched on. You’ll confirm every
        connection, follow-up plan, and customer-facing action.
      </p>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={finishPending}
          className="min-h-11"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Review answers
        </Button>
        <form action={finishAction}>
          <input type="hidden" name="next" value="dashboard" />
          <Button
            type="submit"
            variant="secondary"
            loading={finishPending}
            className="min-h-11 w-full sm:w-auto"
          >
            Skip to Home
          </Button>
        </form>
      </div>
      <p className="sr-only">
        The recommended first step is {first.label}.
      </p>
    </>
  );
}

function StatusChip({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium",
        done
          ? "bg-emerald-50 text-emerald-800"
          : "bg-neutral-100 text-neutral-600"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-4 w-4 place-items-center rounded-full",
          done ? "bg-emerald-600 text-white" : "bg-neutral-300 text-white"
        )}
      >
        {done && <Check className="h-2.5 w-2.5" />}
      </span>
      {label}
    </span>
  );
}


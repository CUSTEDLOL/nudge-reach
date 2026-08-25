"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  FileText,
  ImagePlus,
  LayoutTemplate,
  PenLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { CampaignContent } from "@/modules/campaign/schema";
import { WhatsappPreview } from "@/components/features/whatsapp-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  launchCampaignAction,
  scheduleCampaignAction,
  segmentCountAction,
  wizardAudienceAction,
  wizardBlankAction,
  wizardFromPhotoAction,
  wizardFromTemplateAction,
  type ActionResult,
  type WizardAudienceResult,
  type WizardContentResult,
} from "../actions";
import { LEAD_STAGE_OPTIONS, sourceLabel } from "../wizard-helpers";

export interface WizardTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  content: CampaignContent;
}

export interface WizardAudienceOption {
  id: string;
  name: string;
  optedInCount: number;
}

interface WizardCampaign {
  id: string;
  content: CampaignContent;
  status: "DRAFT" | "TEMPLATE_APPROVED";
  photoUrl: string | null;
}

interface WizardAudiencePick {
  id: string;
  name: string;
  optedInCount: number;
  costLabel: string;
}

const MAX_PHOTO_BYTES = 4.5 * 1024 * 1024;

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result || result.ok) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {result.message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { n: 1, label: "Content" },
  { n: 2, label: "Audience" },
  { n: 3, label: "Review & send" },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <ol
      className="mb-6 flex items-center gap-2 sm:gap-3"
      aria-label="Wizard progress"
    >
      {STEPS.map((step, i) => {
        const done = current > step.n;
        const active = current === step.n;
        return (
          <li key={step.n} className="flex items-center gap-2 sm:gap-3">
            <span
              className={cn(
                "flex items-center gap-2 text-sm font-medium",
                active ? "text-brand-700" : done ? "text-neutral-700" : "text-neutral-400"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  active && "bg-brand-600 text-white",
                  done && "bg-brand-100 text-brand-700",
                  !active && !done && "bg-neutral-100 text-neutral-500"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : step.n}
              </span>
              {/* Inactive labels hide below sm so three steps fit at 375px. */}
              <span className={cn("whitespace-nowrap", !active && "hidden sm:inline")}>
                {step.label}
              </span>
            </span>
            {i < STEPS.length - 1 && (
              <span className="h-px w-5 bg-neutral-200 sm:w-10" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// The wizard
// ---------------------------------------------------------------------------

export function CampaignWizard({
  templates,
  audiences,
  tags,
  sources,
  ratePaise,
  currencySymbol = "₹",
  simulation,
}: {
  templates: WizardTemplate[];
  audiences: WizardAudienceOption[];
  tags: { id: string; name: string }[];
  sources: string[];
  ratePaise: number;
  currencySymbol?: string;
  simulation: boolean;
}) {
  const [step, setStep] = useState(1);
  const [campaign, setCampaign] = useState<WizardCampaign | null>(null);
  const [audience, setAudience] = useState<WizardAudiencePick | null>(null);
  const { toast } = useToast();

  function completeStepOne(result: WizardContentResult) {
    if (result.ok && result.campaignId && result.content && result.status) {
      setCampaign({
        id: result.campaignId,
        content: result.content,
        status: result.status,
        photoUrl: result.photoUrl ?? null,
      });
      setStep(2);
      toast({ description: result.message, tone: "success" });
    }
  }

  return (
    <div>
      <StepIndicator current={step} />

      {step === 1 && (
        <StepContent templates={templates} onDone={completeStepOne} />
      )}

      {step === 2 && campaign && (
        <StepAudience
          campaign={campaign}
          audiences={audiences}
          tags={tags}
          sources={sources}
          onDone={(result) => {
            if (
              result.ok &&
              result.audienceId &&
              result.audienceName &&
              result.optedInCount !== undefined
            ) {
              setAudience({
                id: result.audienceId,
                name: result.audienceName,
                optedInCount: result.optedInCount,
                costLabel: result.estimatedCostLabel ?? "—",
              });
              setStep(3);
            }
          }}
        />
      )}

      {step === 3 && campaign && audience && (
        <StepReview
          campaign={campaign}
          audience={audience}
          ratePaise={ratePaise}
          currencySymbol={currencySymbol}
          simulation={simulation}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — content (From photo / From template / Blank)
// ---------------------------------------------------------------------------

function StepContent({
  templates,
  onDone,
}: {
  templates: WizardTemplate[];
  onDone: (result: WizardContentResult) => void;
}) {
  const [tab, setTab] = useState("photo");

  return (
    <div className="max-w-2xl">
      <Tabs
        aria-label="Where does the message come from?"
        items={[
          { value: "photo", label: "From photo" },
          { value: "template", label: "From template", count: templates.length },
          { value: "blank", label: "Blank" },
        ]}
        value={tab}
        onValueChange={setTab}
        className="mb-5"
      />
      {tab === "photo" && <FromPhotoForm onDone={onDone} />}
      {tab === "template" && (
        <FromTemplateForm templates={templates} onDone={onDone} />
      )}
      {tab === "blank" && <BlankForm onDone={onDone} />}
    </div>
  );
}

function FromPhotoForm({
  onDone,
}: {
  onDone: (result: WizardContentResult) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [result, action, pending] = useActionState(
    async (_prev: WizardContentResult | null, formData: FormData) => {
      const res = await wizardFromPhotoAction(formData);
      onDone(res);
      return res;
    },
    null
  );

  return (
    <Card className="p-6">
      <form action={action} className="flex flex-col gap-5">
        <div>
          <span className="text-sm font-medium text-neutral-700">
            Product photo
          </span>
          <div className="mt-2 flex items-center gap-4">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Your product"
                className="h-24 w-24 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 text-neutral-400">
                <ImagePlus className="h-6 w-6" aria-hidden />
              </div>
            )}
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Product photo"
              className="w-full min-w-0 flex-1 text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && file.size > MAX_PHOTO_BYTES) {
                  setSizeError(
                    "That photo is over 4 MB — most phones can resize it from the share menu, or pick a smaller one."
                  );
                  setPreview(null);
                  e.target.value = "";
                  return;
                }
                setSizeError(null);
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </div>
        </div>

        <Field
          label={
            <>
              Or tell us about it{" "}
              <span className="font-normal text-neutral-400">
                (optional — helps even with a photo)
              </span>
            </>
          }
          htmlFor="wizard-description"
        >
          <Textarea
            id="wizard-description"
            name="description"
            rows={3}
            placeholder="Cotton summer kurtas, new stock, want to give 20% off this week"
          />
        </Field>

        <Button
          type="submit"
          loading={pending}
          size="lg"
          className="w-full sm:w-auto sm:self-start"
        >
          {pending
            ? "Writing your campaign… (about 10 seconds)"
            : "Generate my campaign"}
        </Button>

        {sizeError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {sizeError}
          </p>
        )}
        <Feedback result={result} />
      </form>
    </Card>
  );
}

function FromTemplateForm({
  templates,
  onDone,
}: {
  templates: WizardTemplate[];
  onDone: (result: WizardContentResult) => void;
}) {
  const [selected, setSelected] = useState<string>(templates[0]?.id ?? "");
  const [result, action, pending] = useActionState(
    async (_prev: WizardContentResult | null, formData: FormData) => {
      const res = await wizardFromTemplateAction(formData);
      onDone(res);
      return res;
    },
    null
  );

  if (templates.length === 0) {
    return (
      <Card className="p-6 text-sm text-neutral-600">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <LayoutTemplate className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="font-medium text-neutral-900">
              No approved templates yet
            </p>
            <p className="mt-1">
              Approved templates from your library can be reused here without a
              fresh Meta review.{" "}
              <Link href="/templates" className="font-medium text-brand-700 hover:underline">
                Create one in Templates
              </Link>
              .
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="templateId" value={selected} />
      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label="Approved templates"
      >
        {templates.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(t.id)}
              className={cn(
                "rounded-2xl border bg-white p-4 text-left shadow-soft outline-none transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-brand-400/50",
                active
                  ? "border-brand-500 ring-1 ring-brand-500"
                  : "border-black/5 hover:border-brand-300"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-sm font-medium text-neutral-900">
                  {t.name}
                </p>
                <div className="flex items-center gap-1.5">
                  <Badge tone="success">Approved</Badge>
                  <Badge tone="neutral">{t.category}</Badge>
                </div>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-neutral-500">
                {t.content.body}
              </p>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={!selected}>
          Use this template
        </Button>
        <p className="text-xs text-neutral-500">
          Already approved by Meta — no second review needed.
        </p>
      </div>
      <Feedback result={result} />
    </form>
  );
}

function BlankForm({
  onDone,
}: {
  onDone: (result: WizardContentResult) => void;
}) {
  const [result, action, pending] = useActionState(
    async (_prev: WizardContentResult | null, formData: FormData) => {
      const res = await wizardBlankAction(formData);
      onDone(res);
      return res;
    },
    null
  );

  return (
    <Card className="p-6">
      <form action={action} className="flex flex-col gap-5">
        <Field
          label="What are you promoting?"
          htmlFor="wizard-blank-name"
          hint="Used as the campaign name — you can change everything in the editor."
        >
          <Input
            id="wizard-blank-name"
            name="name"
            maxLength={120}
            placeholder="Weekend sale"
          />
        </Field>
        <div className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-xs text-brand-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            We start you off compliant: the required opt-out footer and the{" "}
            <span className="font-mono">{"{{name}}"}</span> personalization are
            added automatically and can&apos;t be removed.
          </p>
        </div>
        <Button type="submit" loading={pending} className="self-start">
          <PenLine className="h-4 w-4" aria-hidden />
          Start from blank
        </Button>
        <Feedback result={result} />
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — audience
// ---------------------------------------------------------------------------

function StepAudience({
  campaign,
  audiences,
  tags,
  sources,
  onDone,
}: {
  campaign: WizardCampaign;
  audiences: WizardAudienceOption[];
  tags: { id: string; name: string }[];
  sources: string[];
  onDone: (result: WizardAudienceResult) => void;
}) {
  const [mode, setMode] = useState<"existing" | "segment">(
    audiences.length > 0 ? "existing" : "segment"
  );
  const [audienceId, setAudienceId] = useState(audiences[0]?.id ?? "");
  const [stage, setStage] = useState("");
  const [tagId, setTagId] = useState("");
  const [source, setSource] = useState("");
  const [segmentCount, setSegmentCount] = useState<number | null>(null);
  const [counting, startCounting] = useTransition();
  const countRequest = useRef(0);

  const [result, action, pending] = useActionState(
    async (_prev: WizardAudienceResult | null, formData: FormData) => {
      const res = await wizardAudienceAction(formData);
      onDone(res);
      return res;
    },
    null
  );

  // Live opted-in count preview for the segment builder.
  useEffect(() => {
    if (mode !== "segment") return;
    const requestId = ++countRequest.current;
    startCounting(async () => {
      const fd = new FormData();
      fd.set("stage", stage);
      fd.set("tagId", tagId);
      fd.set("source", source);
      const res = await segmentCountAction(fd);
      if (requestId === countRequest.current && res.ok) {
        setSegmentCount(res.count ?? 0);
      }
    });
  }, [mode, stage, tagId, source]);

  const selectedAudience = audiences.find((a) => a.id === audienceId);

  return (
    <div className="max-w-2xl">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Audience type">
        {(
          [
            {
              value: "existing",
              title: "Saved audience",
              hint: `${audiences.length} list${audiences.length === 1 ? "" : "s"} available`,
            },
            {
              value: "segment",
              title: "Build a segment",
              hint: "Filter by stage, tag or source",
            },
          ] as const
        ).map((option) => {
          const active = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(option.value)}
              className={cn(
                "rounded-2xl border bg-white p-4 text-left shadow-soft outline-none transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-brand-400/50",
                active
                  ? "border-brand-500 ring-1 ring-brand-500"
                  : "border-black/5 hover:border-brand-300"
              )}
            >
              <p className="text-sm font-semibold text-neutral-900">
                {option.title}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">{option.hint}</p>
            </button>
          );
        })}
      </div>

      <Card className="p-6">
        <form action={action} className="flex flex-col gap-5">
          <input type="hidden" name="campaignId" value={campaign.id} />
          <input type="hidden" name="mode" value={mode} />

          {mode === "existing" ? (
            audiences.length === 0 ? (
              <p className="text-sm text-neutral-600">
                No saved audiences yet —{" "}
                <Link href="/contacts" className="font-medium text-brand-700 hover:underline">
                  create one from your customers
                </Link>{" "}
                or build a segment instead.
              </p>
            ) : (
              <Field label="Send to" htmlFor="wizard-audience">
                <Select
                  id="wizard-audience"
                  name="audienceId"
                  value={audienceId}
                  onChange={(e) => setAudienceId(e.target.value)}
                >
                  {audiences.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.optedInCount} opted in)
                    </option>
                  ))}
                </Select>
              </Field>
            )
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Lead stage" htmlFor="wizard-stage">
                  <Select
                    id="wizard-stage"
                    name="stage"
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  >
                    <option value="">Any stage</option>
                    {LEAD_STAGE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tag" htmlFor="wizard-tag">
                  <Select
                    id="wizard-tag"
                    name="tagId"
                    value={tagId}
                    onChange={(e) => setTagId(e.target.value)}
                  >
                    <option value="">Any tag</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Opt-in source" htmlFor="wizard-source">
                  <Select
                    id="wizard-source"
                    name="source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="">Any source</option>
                    {sources.map((s) => (
                      <option key={s} value={s}>
                        {sourceLabel(s)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-sm">
                <Users className="h-4 w-4 text-brand-600" aria-hidden />
                {counting || segmentCount === null ? (
                  <span className="text-neutral-500">Counting…</span>
                ) : (
                  <span className="text-neutral-700">
                    <strong className="font-semibold text-neutral-900">
                      {segmentCount}
                    </strong>{" "}
                    opted-in customer{segmentCount === 1 ? "" : "s"} match
                  </span>
                )}
                <span className="ml-auto text-xs text-neutral-400">
                  Saved as &ldquo;Segment: …&rdquo; when you continue
                </span>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
            <p className="text-xs text-neutral-400">
              Only opted-in customers are ever counted or messaged.
            </p>
            <Button
              type="submit"
              loading={pending}
              disabled={
                mode === "existing"
                  ? !selectedAudience || selectedAudience.optedInCount === 0
                  : segmentCount === 0
              }
            >
              Continue
            </Button>
          </div>
          <Feedback result={result} />
        </form>
      </Card>

      <p className="mt-3 text-xs text-neutral-400">
        Your message is saved as a draft — you can fine-tune the wording later
        from the campaign page.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — review, compliance interstitial, send now / schedule
// ---------------------------------------------------------------------------

function StepReview({
  campaign,
  audience,
  ratePaise,
  currencySymbol = "₹",
  simulation,
  onBack,
}: {
  campaign: WizardCampaign;
  audience: WizardAudiencePick;
  ratePaise: number;
  currencySymbol?: string;
  simulation: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [minLocal, setMinLocal] = useState("");
  const approved = campaign.status === "TEMPLATE_APPROVED";

  // Computed in the event handler (not during render — hooks purity).
  function chooseLater() {
    setWhen("later");
    setMinLocal(toLocalInputValue(new Date()));
    setScheduledAtLocal(
      (prev) => prev || toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000))
    );
  }

  const [sendResult, sendAction, sending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const res = await launchCampaignAction(formData);
      if (res.ok) {
        toast({ description: res.message, tone: "success" });
        router.push(`/campaigns/${campaign.id}`);
      }
      return res;
    },
    null
  );
  const [scheduleResult, scheduleAction, scheduling] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const local = String(formData.get("scheduledAtLocal") ?? "");
      const parsed = new Date(local);
      if (Number.isNaN(parsed.getTime())) {
        return { ok: false, message: "Pick a valid date and time." };
      }
      formData.set("scheduledAtIso", parsed.toISOString());
      const res = await scheduleCampaignAction(formData);
      if (res.ok) {
        toast({ description: res.message, tone: "success" });
        router.push(`/campaigns/${campaign.id}`);
      }
      return res;
    },
    null
  );

  const pending = sending || scheduling;
  const result = when === "later" ? scheduleResult : sendResult;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <form
        action={when === "later" ? scheduleAction : sendAction}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="campaignId" value={campaign.id} />

        {/* Summary */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">
              {campaign.content.productName}
            </h2>
            {approved ? (
              <Badge tone="brand">Ready to send</Badge>
            ) : (
              <Badge tone="warning">Needs Meta approval</Badge>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3 sm:gap-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Audience
              </dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {audience.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Recipients
              </dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {audience.optedInCount} opted in
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Est. cost
              </dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {audience.costLabel}{" "}
                <span className="text-xs font-normal text-neutral-400">
                  ({audience.optedInCount} × {currencySymbol}{(ratePaise / 100).toFixed(2)},
                  estimate)
                </span>
              </dd>
            </div>
          </dl>
        </Card>

        {/* Compliance interstitial */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-neutral-900">
                Consent check
              </h2>
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  name="consentConfirmed"
                  required
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-brand-600"
                />
                <span>
                  These contacts <strong>opted in</strong> to WhatsApp marketing
                  from my business.
                </span>
              </label>
              <p className="mt-2 text-xs text-neutral-500">
                Meta policy: marketing templates may only be sent to people who
                gave consent, and every message carries an opt-out. Bought
                lists get your number banned — opt-outs are honored permanently
                and enforced in code either way.
              </p>
            </div>
          </div>
        </Card>

        {/* When */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-neutral-900">
            When should it go out?
          </h2>
          <div className="mt-3 flex flex-col gap-2.5">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="radio"
                name="whenChoice"
                checked={when === "now"}
                onChange={() => setWhen("now")}
                className="h-4 w-4 accent-brand-600"
              />
              {approved ? "Send now" : "Send now (submits to Meta for approval first)"}
            </label>
            <label
              className={cn(
                "flex items-center gap-2 text-sm",
                approved ? "text-neutral-700" : "cursor-not-allowed text-neutral-400"
              )}
            >
              <input
                type="radio"
                name="whenChoice"
                checked={when === "later"}
                onChange={chooseLater}
                disabled={!approved}
                className="h-4 w-4 accent-brand-600"
              />
              Schedule for later
            </label>
            {!approved && (
              <p className="ml-6 flex items-center gap-1.5 text-xs text-amber-700">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                Meta approval required first — submit now, then schedule from
                the campaign page once it&apos;s approved.
              </p>
            )}
            {when === "later" && approved && (
              <div className="ml-6 max-w-xs">
                <Input
                  type="datetime-local"
                  name="scheduledAtLocal"
                  value={scheduledAtLocal}
                  min={minLocal || undefined}
                  onChange={(e) => setScheduledAtLocal(e.target.value)}
                  required
                  aria-label="Scheduled date and time"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Future times only — the queue releases it automatically.
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <Button type="button" variant="secondary" onClick={onBack} disabled={pending}>
            Back
          </Button>
          <Button type="submit" loading={pending}>
            {when === "later"
              ? "Schedule broadcast"
              : approved
                ? simulation
                  ? "Send now (test mode)"
                  : "Send now"
                : "Submit for approval"}
          </Button>
        </div>
        {simulation && (
          <p className="text-xs text-neutral-400">
            Test mode: no real messages leave the building — delivery is
            mocked so you can see the full journey.
          </p>
        )}
        <Feedback result={result} />
      </form>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          What {campaign.content.sampleName || "your customer"} will see
        </p>
        <WhatsappPreview content={campaign.content} photoUrl={campaign.photoUrl} />
      </div>
    </div>
  );
}

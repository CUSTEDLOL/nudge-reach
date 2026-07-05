"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  FlaskConical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  LEAD_STAGES,
  type AutomationTrigger,
  type StepKind,
} from "@/modules/automation/definitions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  deleteAutomation,
  saveAutomation,
  testRunAutomation,
  type SaveAutomationResult,
  type TestRunResult,
} from "./actions";
import { STEP_META, TRIGGER_META, stepMeta } from "./meta";
import { RunLog } from "./run-log";

export interface BuilderOptions {
  /** Library templates: APPROVED selectable, PENDING shown but disabled. */
  templates: { id: string; name: string; status: string }[];
  tags: { id: string; name: string }[];
  members: { userId: string; label: string }[];
  /** Contacts for the test-run picker (edit mode only). */
  contacts: { id: string; name: string; phoneE164: string }[];
}

export interface BuilderInitial {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  keywords: string[];
  match: "contains" | "exact";
  /** A seeded tag_added scope we preserve on save (no UI to edit it). */
  preservedTagName?: string;
  steps: { kind: StepKind; config: Record<string, unknown> }[];
}

interface StepState {
  uid: number;
  kind: StepKind;
  config: Record<string, string>;
}

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  WON: "Won",
  LOST: "Lost",
};

function toStepState(
  step: { kind: StepKind; config: Record<string, unknown> },
  uid: number
): StepState {
  const raw = step.config ?? {};
  const str = (key: string) => (raw[key] == null ? "" : String(raw[key]));
  switch (step.kind) {
    case "send_message":
      // `body` is the legacy seeded key — normalize to `text` for editing.
      return { uid, kind: step.kind, config: { text: str("text") || str("body") } };
    case "send_template":
      return { uid, kind: step.kind, config: { templateId: str("templateId") } };
    case "add_tag":
      return { uid, kind: step.kind, config: { tagId: str("tagId") } };
    case "assign_agent":
      return { uid, kind: step.kind, config: { userId: str("userId") } };
    case "update_lead_stage":
      return { uid, kind: step.kind, config: { stage: str("stage") } };
    case "wait":
      return { uid, kind: step.kind, config: { minutes: str("minutes") || "5" } };
    default:
      return { uid, kind: step.kind, config: {} };
  }
}

function defaultStep(kind: StepKind, uid: number): StepState {
  return toStepState({ kind, config: kind === "wait" ? { minutes: "5" } : {} }, uid);
}

/** Serialize builder state back into the engine's step config shapes. */
function toPayloadConfig(step: StepState): Record<string, unknown> {
  switch (step.kind) {
    case "send_message":
      return { text: step.config.text?.trim() ?? "" };
    case "send_template":
      return { templateId: step.config.templateId ?? "" };
    case "add_tag":
      return { tagId: step.config.tagId ?? "" };
    case "assign_agent":
      return { userId: step.config.userId ?? "" };
    case "update_lead_stage":
      return { stage: step.config.stage ?? "" };
    case "wait":
      return { minutes: Number(step.config.minutes) };
    default:
      return {};
  }
}

export function AutomationBuilder({
  initial,
  options,
  readOnly = false,
}: {
  initial: BuilderInitial;
  options: BuilderOptions;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [trigger, setTrigger] = useState<AutomationTrigger>(initial.trigger);
  const [keywords, setKeywords] = useState<string[]>(initial.keywords);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [match, setMatch] = useState<"contains" | "exact">(initial.match);
  const [steps, setSteps] = useState<StepState[]>(
    initial.steps.map((step, index) => toStepState(step, index + 1))
  );
  const [nextUid, setNextUid] = useState(initial.steps.length + 1);

  const payload = JSON.stringify({
    name: name.trim(),
    description: description.trim(),
    enabled,
    trigger,
    triggerConfig: trigger === "keyword" ? { keywords, match } : {},
    steps: steps.map((step) => ({ kind: step.kind, config: toPayloadConfig(step) })),
  });

  const [, formAction, saving] = useActionState(
    async (_prev: SaveAutomationResult | null, formData: FormData) => {
      const result = await saveAutomation(formData);
      toast({
        description: result.message,
        tone: result.ok ? "success" : "error",
      });
      if (result.ok && !initial.id && result.id) {
        router.push(`/automations/${result.id}`);
      }
      return result;
    },
    null
  );

  function addKeyword() {
    const value = keywordDraft.trim();
    if (!value) return;
    if (!keywords.some((k) => k.toLowerCase() === value.toLowerCase())) {
      setKeywords([...keywords, value]);
    }
    setKeywordDraft("");
  }

  function addStep(kind: StepKind) {
    setSteps((prev) => [...prev, defaultStep(kind, nextUid)]);
    setNextUid((uid) => uid + 1);
  }

  function moveStep(index: number, delta: -1 | 1) {
    setSteps((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function patchStep(index: number, patch: Record<string, string>) {
    setSteps((prev) =>
      prev.map((step, i) =>
        i === index ? { ...step, config: { ...step.config, ...patch } } : step
      )
    );
  }

  return (
    <form action={formAction}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="payload" value={payload} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>
                Name it so your team knows what it does at a glance.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field label="Name" htmlFor="automation-name" required>
                <Input
                  id="automation-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Welcome new customers"
                  maxLength={80}
                  disabled={readOnly}
                />
              </Field>
              <Field label="Description" htmlFor="automation-description">
                <Textarea
                  id="automation-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this automation does and why."
                  rows={2}
                  maxLength={300}
                  disabled={readOnly}
                />
              </Field>
            </CardContent>
          </Card>

          {/* Trigger */}
          <Card>
            <CardHeader>
              <CardTitle>Trigger</CardTitle>
              <CardDescription>When should this automation run?</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div
                role="radiogroup"
                aria-label="Trigger"
                className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
              >
                {TRIGGER_META.map((option) => {
                  const Icon = option.icon;
                  const selected = trigger === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={readOnly}
                      onClick={() => setTrigger(option.value)}
                      className={cn(
                        "flex flex-col gap-1 rounded-xl border p-3 text-left outline-none transition-colors duration-150",
                        "focus-visible:ring-2 focus-visible:ring-brand-400/50",
                        "disabled:cursor-not-allowed disabled:opacity-60",
                        selected
                          ? "border-brand-500 bg-brand-50/60"
                          : "border-neutral-200 bg-white hover:border-neutral-300"
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            selected ? "text-brand-600" : "text-neutral-400"
                          )}
                          aria-hidden
                        />
                        {option.label}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {trigger === "keyword" && (
                <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                  <Field
                    label="Keywords"
                    htmlFor="keyword-input"
                    hint="Press Enter to add. Matching is case-insensitive."
                  >
                    <div className="flex flex-col gap-2">
                      {keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {keywords.map((keyword) => (
                            <span
                              key={keyword}
                              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                            >
                              {keyword}
                              {!readOnly && (
                                <button
                                  type="button"
                                  aria-label={`Remove keyword ${keyword}`}
                                  onClick={() =>
                                    setKeywords(keywords.filter((k) => k !== keyword))
                                  }
                                  className="-mr-0.5 rounded-full p-0.5 outline-none transition-colors duration-150 hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-brand-400/50"
                                >
                                  <X className="h-3 w-3" aria-hidden />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      <Input
                        id="keyword-input"
                        value={keywordDraft}
                        onChange={(e) => setKeywordDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addKeyword();
                          }
                        }}
                        onBlur={addKeyword}
                        placeholder="hours, timing, kab khulta…"
                        disabled={readOnly}
                      />
                    </div>
                  </Field>
                  <fieldset className="flex items-center gap-4">
                    <legend className="sr-only">Match type</legend>
                    {(["contains", "exact"] as const).map((mode) => (
                      <label
                        key={mode}
                        className="flex items-center gap-1.5 text-sm text-neutral-700"
                      >
                        <input
                          type="radio"
                          name="keyword-match"
                          className="accent-brand-600"
                          checked={match === mode}
                          onChange={() => setMatch(mode)}
                          disabled={readOnly}
                        />
                        {mode === "contains" ? "Message contains" : "Exact match"}
                      </label>
                    ))}
                  </fieldset>
                </div>
              )}

              {trigger === "tag_added" && initial.preservedTagName && (
                <p className="text-xs text-neutral-500">
                  Scoped to the tag{" "}
                  <span className="font-medium text-neutral-700">
                    “{initial.preservedTagName}”
                  </span>{" "}
                  — this scope is kept when you save.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Steps */}
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle>Steps</CardTitle>
                <CardDescription>
                  Run in order, top to bottom. A failed step stops the run.
                </CardDescription>
              </div>
              {!readOnly && (
                <Menu
                  trigger={
                    <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:bg-neutral-50">
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Add step
                    </span>
                  }
                  triggerLabel="Add step"
                >
                  <MenuLabel>Add a step</MenuLabel>
                  {STEP_META.map((option) => {
                    const Icon = option.icon;
                    return (
                      <MenuItem
                        key={option.value}
                        icon={<Icon className="h-4 w-4 text-neutral-400" aria-hidden />}
                        onSelect={() => addStep(option.value)}
                      >
                        {option.label}
                      </MenuItem>
                    );
                  })}
                </Menu>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {steps.length === 0 && (
                <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                  No steps yet — add at least one step for this automation to do
                  anything.
                </p>
              )}
              {steps.map((step, index) => (
                <StepEditor
                  key={step.uid}
                  step={step}
                  index={index}
                  total={steps.length}
                  options={options}
                  readOnly={readOnly}
                  onMove={moveStep}
                  onRemove={removeStep}
                  onPatch={patchStep}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right rail: status + save, test run, danger zone */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Enabled</p>
                  <p className="text-xs text-neutral-500">
                    Paused automations never fire.
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  disabled={readOnly}
                  aria-label="Enabled"
                />
              </div>
              {readOnly ? (
                <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                  You have read-only access — ask an admin to make changes.
                </p>
              ) : (
                <Button type="submit" loading={saving} className="w-full">
                  {initial.id ? "Save changes" : "Create automation"}
                </Button>
              )}
            </CardContent>
          </Card>

          {initial.id && !readOnly && (
            <TestRunPanel automationId={initial.id} contacts={options.contacts} />
          )}

          {initial.id && !readOnly && (
            <DangerZone automationId={initial.id} name={name} />
          )}
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step editor
// ---------------------------------------------------------------------------

function StepEditor({
  step,
  index,
  total,
  options,
  readOnly,
  onMove,
  onRemove,
  onPatch,
}: {
  step: StepState;
  index: number;
  total: number;
  options: BuilderOptions;
  readOnly: boolean;
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (index: number) => void;
  onPatch: (index: number, patch: Record<string, string>) => void;
}) {
  const meta = stepMeta(step.kind);
  const Icon = meta.icon;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
            {index + 1}
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
            <Icon className="h-4 w-4 text-neutral-400" aria-hidden />
            {meta.label}
          </span>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            <IconButton
              label={`Move step ${index + 1} up`}
              disabled={index === 0}
              onClick={() => onMove(index, -1)}
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
            </IconButton>
            <IconButton
              label={`Move step ${index + 1} down`}
              disabled={index === total - 1}
              onClick={() => onMove(index, 1)}
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            </IconButton>
            <IconButton
              label={`Remove step ${index + 1}`}
              onClick={() => onRemove(index)}
              danger
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </IconButton>
          </div>
        )}
      </div>
      <div className="mt-3">
        <StepConfigFields
          step={step}
          index={index}
          options={options}
          readOnly={readOnly}
          onPatch={onPatch}
        />
      </div>
    </div>
  );
}

function StepConfigFields({
  step,
  index,
  options,
  readOnly,
  onPatch,
}: {
  step: StepState;
  index: number;
  options: BuilderOptions;
  readOnly: boolean;
  onPatch: (index: number, patch: Record<string, string>) => void;
}) {
  const id = `step-${step.uid}`;
  switch (step.kind) {
    case "send_message":
      return (
        <Field
          label="Message text"
          htmlFor={id}
          hint="Free-form replies only work within 24h of the customer's last message."
        >
          <Textarea
            id={id}
            value={step.config.text ?? ""}
            onChange={(e) => onPatch(index, { text: e.target.value })}
            placeholder="Namaste! Hum Mon–Sat 10:30am–8:30pm khule hain 😊"
            rows={3}
            maxLength={1024}
            disabled={readOnly}
          />
        </Field>
      );
    case "send_template":
      return (
        <Field
          label="Template"
          htmlFor={id}
          hint="{{1}} becomes the contact's first name. Marketing templates only go to opted-in contacts."
        >
          <Select
            id={id}
            value={step.config.templateId ?? ""}
            onChange={(e) => onPatch(index, { templateId: e.target.value })}
            disabled={readOnly}
          >
            <option value="" disabled>
              {options.templates.length === 0
                ? "No library templates yet"
                : "Pick a template…"}
            </option>
            {options.templates.map((template) => (
              <option
                key={template.id}
                value={template.id}
                disabled={template.status !== "APPROVED"}
              >
                {template.name}
                {template.status !== "APPROVED"
                  ? ` (${template.status.toLowerCase()} — not sendable)`
                  : ""}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "add_tag":
      return (
        <Field label="Tag" htmlFor={id}>
          <Select
            id={id}
            value={step.config.tagId ?? ""}
            onChange={(e) => onPatch(index, { tagId: e.target.value })}
            disabled={readOnly}
          >
            <option value="" disabled>
              {options.tags.length === 0 ? "No tags yet" : "Pick a tag…"}
            </option>
            {options.tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "assign_agent":
      return (
        <Field label="Teammate" htmlFor={id}>
          <Select
            id={id}
            value={step.config.userId ?? ""}
            onChange={(e) => onPatch(index, { userId: e.target.value })}
            disabled={readOnly}
          >
            <option value="" disabled>
              Pick a teammate…
            </option>
            {options.members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.label}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "update_lead_stage":
      return (
        <Field label="Lead stage" htmlFor={id}>
          <Select
            id={id}
            value={step.config.stage ?? ""}
            onChange={(e) => onPatch(index, { stage: e.target.value })}
            disabled={readOnly}
          >
            <option value="" disabled>
              Pick a stage…
            </option>
            {LEAD_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage] ?? stage}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "wait":
      return (
        <Field label="Wait for (minutes)" htmlFor={id} hint="The run pauses, then resumes automatically.">
          <Input
            id={id}
            type="number"
            min={1}
            max={10080}
            value={step.config.minutes ?? "5"}
            onChange={(e) => onPatch(index, { minutes: e.target.value })}
            disabled={readOnly}
            className="max-w-[10rem]"
          />
        </Field>
      );
    default:
      return (
        <p className="text-xs text-neutral-500">No configuration needed.</p>
      );
  }
}

function IconButton({
  label,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg p-1.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-400/50",
        "disabled:pointer-events-none disabled:opacity-40",
        danger
          ? "text-neutral-400 hover:bg-red-50 hover:text-red-600"
          : "text-neutral-400 hover:bg-black/5 hover:text-neutral-700"
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Test run (simulation) panel
// ---------------------------------------------------------------------------

function TestRunPanel({
  automationId,
  contacts,
}: {
  automationId: string;
  contacts: { id: string; name: string; phoneE164: string }[];
}) {
  const { toast } = useToast();
  const [contactId, setContactId] = useState("");
  const [result, setResult] = useState<TestRunResult | null>(null);
  const [testing, startTesting] = useTransition();

  function runTest() {
    if (!contactId) {
      toast({ description: "Pick a contact to test with.", tone: "error" });
      return;
    }
    startTesting(async () => {
      const formData = new FormData();
      formData.set("automationId", automationId);
      formData.set("contactId", contactId);
      const res = await testRunAutomation(formData);
      setResult(res);
      toast({ description: res.message, tone: res.ok ? "success" : "error" });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-brand-600" aria-hidden />
          Test run
        </CardTitle>
        <CardDescription>
          Runs the saved steps against a contact right now using the simulation
          sender. Unsaved edits are not included.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field label="Contact" htmlFor="test-contact">
          <Select
            id="test-contact"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="" disabled>
              {contacts.length === 0 ? "No contacts yet" : "Pick a contact…"}
            </option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name} · {contact.phoneE164}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          type="button"
          variant="secondary"
          loading={testing}
          onClick={runTest}
          disabled={contacts.length === 0}
        >
          <FlaskConical className="h-4 w-4" aria-hidden />
          Run test
        </Button>
        {result?.log && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Step log
              </p>
              {result.status && (
                <Badge
                  tone={
                    result.status === "COMPLETED"
                      ? "success"
                      : result.status === "FAILED"
                        ? "danger"
                        : "warning"
                  }
                >
                  {result.status.toLowerCase()}
                </Badge>
              )}
            </div>
            <RunLog entries={result.log} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Danger zone
// ---------------------------------------------------------------------------

function DangerZone({
  automationId,
  name,
}: {
  automationId: string;
  name: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-red-700">Danger zone</CardTitle>
        <CardDescription>
          Deleting removes the automation and its run history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="danger"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete automation
        </Button>
        <ConfirmDialog
          open={confirming}
          onClose={() => setConfirming(false)}
          title={`Delete “${name || "this automation"}”?`}
          description="This can't be undone. Contacts and conversations it touched are unaffected."
          confirmLabel="Delete"
          tone="danger"
          onConfirm={async () => {
            const formData = new FormData();
            formData.set("automationId", automationId);
            const result = await deleteAutomation(formData);
            toast({
              description: result.message,
              tone: result.ok ? "success" : "error",
            });
            if (result.ok) router.push("/automations");
          }}
        />
      </CardContent>
    </Card>
  );
}

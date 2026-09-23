"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  MAX_RULE_TEXT_LENGTH,
  RULE_QUALITY_NUDGE_AT,
  type RuleListItem,
  type RuleScope,
} from "@/modules/agent/rules";
import {
  archiveRuleAction,
  createRuleAction,
  updateRuleAction,
} from "./rules-actions";
import { SectionHeader } from "./section-header";

/**
 * House rules — how the AI should behave, as opposed to what is true.
 *
 * The owner writes a plain sentence and it is stored as written; the one-line
 * version the prompt carries is distilled on the server and deliberately never
 * shown, so this list is always the owner's own words.
 */
export function RulesSection({
  rules,
  canEdit,
  limit,
}: {
  rules: RuleListItem[];
  canEdit: boolean;
  limit: number;
}) {
  const atLimit = rules.length >= limit;
  // The add form opens itself on the first visit (no rules yet) and stays out
  // of the way ever after — the same first-visit logic as "Your business".
  // Closed means absent from the DOM, not merely hidden.
  const [adding, setAdding] = useState(canEdit && rules.length === 0);

  return (
    <section aria-labelledby="house-rules-heading">
      <SectionHeader
        id="house-rules-heading"
        title="House rules"
        meta={`${rules.length} of ${limit}`}
        action={
          canEdit && (
            <Button
              size="sm"
              variant="secondary"
              disabled={atLimit || adding}
              title={atLimit ? "Rule limit reached" : undefined}
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add rule
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-3">
        {canEdit && adding && (
          <AddRuleForm atLimit={atLimit} onDone={() => setAdding(false)} />
        )}
        {rules.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-neutral-100">
              {rules.map((rule) => (
                <RuleRow key={rule.id} rule={rule} canEdit={canEdit} />
              ))}
            </ul>
          </Card>
        )}
      </div>
      <p className="mt-2 text-xs text-neutral-500" role="status">
        {explanation(rules.length, limit)}
      </p>
    </section>
  );
}

/**
 * The one line under the box. From ten rules on it carries the quality nudge
 * (founder decision 2026-09-22: the cap is about how reliably a model obeys a
 * long list of competing orders, not cost — rules ride in the cached part of
 * the prompt — so it nudges and never blocks); at the cap, the way out.
 */
function explanation(count: number, limit: number): string {
  const base = "What it must always or never do. Rules win over facts.";
  if (count === 0) {
    return `${base} Try: “always send the booking link first”, “never quote a price over chat”.`;
  }
  if (count >= limit) {
    return `${base} Rule limit reached (${count}/${limit}). Archive one to add another — a short list is one your AI follows.`;
  }
  if (count >= RULE_QUALITY_NUDGE_AT) {
    return `${base} The more rules you add, the less reliably the AI follows each one.`;
  }
  return base;
}

/** The bold lead-in that makes a row read as a sentence: "Never quote a price over chat". */
function scopeLead(rule: RuleListItem): string | null {
  if (rule.scope === "always") return "Always";
  if (rule.scope === "never") return "Never";
  const condition = rule.condition?.trim();
  // A "when" rule with no condition can only come from a bad migration; its
  // text alone is honest, where "Always" would claim a scope it lacks.
  return condition ? `When ${condition},` : null;
}

const SCOPE_OPTIONS: { value: RuleScope; label: string }[] = [
  { value: "always", label: "Always" },
  { value: "never", label: "Never" },
  { value: "when", label: "In one situation" },
];

function AddRuleForm({
  atLimit,
  onDone,
}: {
  atLimit: boolean;
  /** Called once the rule is saved, and on Cancel; the form unmounts. */
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [scope, setScope] = useState<RuleScope>("always");
  const [condition, setCondition] = useState("");
  const [pending, start] = useTransition();

  function add() {
    start(async () => {
      const r = await createRuleAction(
        text,
        scope,
        scope === "when" ? condition : undefined,
      );
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
      if (r.ok) onDone();
    });
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        <Field label="Rule" htmlFor="rule-text">
          <Textarea
            id="rule-text"
            value={text}
            disabled={atLimit || pending}
            rows={2}
            maxLength={MAX_RULE_TEXT_LENGTH}
            placeholder="e.g. push everyone who messages us to join the waitlist"
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="When it applies" htmlFor="rule-scope" className="sm:w-52">
            <Select
              id="rule-scope"
              value={scope}
              disabled={atLimit || pending}
              onChange={(e) => setScope(e.target.value as RuleScope)}
            >
              {SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          {scope === "when" && (
            <Field label="The situation" htmlFor="rule-condition" className="flex-1">
              <Input
                id="rule-condition"
                value={condition}
                disabled={atLimit || pending}
                placeholder="e.g. someone asks about pricing"
                onChange={(e) => setCondition(e.target.value)}
              />
            </Field>
          )}
          <div className="flex gap-2">
            <Button
              loading={pending}
              disabled={atLimit || text.trim().length < 3}
              onClick={add}
            >
              Add rule
            </Button>
            <Button variant="ghost" disabled={pending} onClick={onDone}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RuleRow({ rule, canEdit }: { rule: RuleListItem; canEdit: boolean }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(rule.text);
  const [scope, setScope] = useState<RuleScope>(rule.scope);
  const [condition, setCondition] = useState(rule.condition ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const r = await updateRuleAction(
        rule.id,
        text,
        scope,
        scope === "when" ? condition : undefined,
      );
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
      if (r.ok) setEditing(false);
    });
  }

  function archive() {
    start(async () => {
      const r = await archiveRuleAction(rule.id);
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
    });
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 bg-neutral-50 px-4 py-3">
        <Textarea
          value={text}
          disabled={pending}
          rows={2}
          maxLength={MAX_RULE_TEXT_LENGTH}
          aria-label="Rule"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={scope}
            disabled={pending}
            aria-label="When it applies"
            className="sm:w-52"
            onChange={(e) => setScope(e.target.value as RuleScope)}
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {scope === "when" && (
            <Input
              value={condition}
              disabled={pending}
              aria-label="The situation"
              placeholder="e.g. someone asks about pricing"
              className="flex-1"
              onChange={(e) => setCondition(e.target.value)}
            />
          )}
          <div className="flex gap-1">
            <Button
              size="sm"
              loading={pending}
              disabled={text.trim().length < 3}
              onClick={save}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Cancel"
              disabled={pending}
              onClick={() => {
                setText(rule.text);
                setScope(rule.scope);
                setCondition(rule.condition ?? "");
                setEditing(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </li>
    );
  }

  const lead = scopeLead(rule);
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <p className="min-w-0 flex-1 text-sm text-neutral-700">
        {lead && (
          <>
            <span className="font-semibold text-neutral-900">{lead}</span>{" "}
          </>
        )}
        {rule.text.trim()}
      </p>
      {canEdit && (
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Edit rule"
            disabled={pending}
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Archive rule"
            disabled={pending}
            onClick={archive}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </li>
  );
}

"use client";

import { useState, useTransition } from "react";
import { ListChecks, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  MAX_RULE_TEXT_LENGTH,
  RULE_QUALITY_NUDGE_AT,
  describeRule,
  type RuleListItem,
  type RuleScope,
} from "@/modules/agent/rules";
import {
  archiveRuleAction,
  createRuleAction,
  updateRuleAction,
} from "./rules-actions";

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

  return (
    <section
      aria-labelledby="house-rules-heading"
      className="flex flex-col gap-4"
    >
      <div>
        <h2
          id="house-rules-heading"
          className="text-sm font-semibold text-neutral-900"
        >
          House rules
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          How your AI should behave. A rule outranks everything it knows — if a
          rule and a fact disagree, it follows the rule.
        </p>
        <p className="mt-1 text-xs text-neutral-500" role="status">
          {counterLine(rules.length, limit)}
        </p>
      </div>

      {canEdit && <AddRuleForm count={rules.length} limit={limit} atLimit={atLimit} />}

      {rules.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-5 w-5" />}
          title="No rules yet"
          description="A rule is an order, not a fact: “always send the booking link first”, “never quote a price over chat”. Your AI follows it in every reply."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The count doubles as the quality warning. Founder decision 2026-09-22: the
 * cap is about how reliably a model obeys a long list of competing orders, not
 * about cost — rules ride in the cached part of the prompt. So this nudges
 * from ten rules onward and never blocks.
 */
function counterLine(count: number, limit: number): string {
  const counter = `${count} of ${limit}`;
  return count >= RULE_QUALITY_NUDGE_AT
    ? `${counter} · the more rules you add, the less reliably the AI follows each one.`
    : counter;
}

const SCOPE_OPTIONS: { value: RuleScope; label: string }[] = [
  { value: "always", label: "Always" },
  { value: "never", label: "Never" },
  { value: "when", label: "In one situation" },
];

function AddRuleForm({
  count,
  limit,
  atLimit,
}: {
  count: number;
  limit: number;
  atLimit: boolean;
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
      if (r.ok) {
        setText("");
        setCondition("");
        setScope("always");
      }
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
          <Button
            loading={pending}
            disabled={atLimit || text.trim().length < 3}
            onClick={add}
          >
            Add rule
          </Button>
        </div>
      </div>
      {atLimit && (
        <p className="mt-2 text-sm text-neutral-600" role="status">
          Rule limit reached ({count}/{limit}). Archive one to add another — a
          short list is one your AI follows.
        </p>
      )}
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
      <li className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
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

  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border border-neutral-100 bg-white p-3">
      <p className="min-w-0 flex-1 text-sm text-neutral-800">
        {describeRule(rule)}
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

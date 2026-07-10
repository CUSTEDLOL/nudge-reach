"use client";

import { useState, useTransition } from "react";
import { BookOpen, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  addFactAction,
  archiveFactAction,
  structureExistingInfoAction,
  updateFactAction,
} from "./actions";

export interface LibraryFact {
  id: string;
  category: string;
  fact: string;
  condition: string | null;
  source: string;
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "menu_services", label: "Menu & services" },
  { value: "pricing", label: "Pricing" },
  { value: "hours", label: "Hours" },
  { value: "location", label: "Location" },
  { value: "policies", label: "Policies" },
  { value: "payments", label: "Payments" },
  { value: "faq", label: "FAQ" },
  { value: "other", label: "Other" },
];
const LABEL_BY_VALUE = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label])
);

function FactRow({ f, canEdit }: { f: LibraryFact; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [fact, setFact] = useState(f.fact);
  const [condition, setCondition] = useState(f.condition ?? "");
  const [category, setCategory] = useState(f.category);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:flex-row sm:items-center">
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="sm:w-44"
          aria-label="Category"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          value={fact}
          onChange={(e) => setFact(e.target.value)}
          className="flex-1"
          aria-label="Fact"
        />
        <Input
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder="only when… (optional)"
          className="sm:w-48"
          aria-label="Condition"
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            disabled={pending || fact.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                const r = await updateFactAction(f.id, {
                  category,
                  fact,
                  condition,
                });
                if (r.ok) setEditing(false);
              })
            }
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Cancel"
            onClick={() => setEditing(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border border-neutral-100 bg-white p-3">
      <div className="min-w-0">
        <p className="text-sm text-neutral-800">{f.fact}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {f.condition && <Badge tone="warning">only: {f.condition}</Badge>}
          {f.source === "owner_answer" && (
            <Badge tone="success">learned on the job</Badge>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Edit fact"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Archive fact"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await archiveFactAction(f.id);
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </li>
  );
}

function AddFactForm() {
  const [category, setCategory] = useState("menu_services");
  const [fact, setFact] = useState("");
  const [condition, setCondition] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Category" htmlFor="kf-category" className="sm:w-44">
          <Select
            id="kf-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fact" htmlFor="kf-fact" className="flex-1">
          <Input
            id="kf-fact"
            value={fact}
            onChange={(e) => setFact(e.target.value)}
            placeholder="e.g. Bridal mehendi package is ₹5,000"
          />
        </Field>
        <Field label="Condition (optional)" htmlFor="kf-cond" className="sm:w-52">
          <Input
            id="kf-cond"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="e.g. weekends only"
          />
        </Field>
        <Button
          disabled={pending || fact.trim().length < 3}
          onClick={() =>
            startTransition(async () => {
              const r = await addFactAction({ category, fact, condition });
              setMessage(r.message);
              if (r.ok) {
                setFact("");
                setCondition("");
              }
            })
          }
        >
          {pending ? "Adding…" : "Add fact"}
        </Button>
      </div>
      {message && <p className="mt-2 text-sm text-neutral-500">{message}</p>}
    </Card>
  );
}

export function Library({
  facts,
  canEdit,
  showStructureButton,
}: {
  facts: LibraryFact[];
  canEdit: boolean;
  showStructureButton: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = CATEGORY_OPTIONS.map((o) => ({
    ...o,
    facts: facts.filter((f) => f.category === o.value),
  })).filter((g) => g.facts.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {canEdit && <AddFactForm />}

      {canEdit && showStructureButton && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <Sparkles className="h-4 w-4 text-brand-600" />
            You have unstructured business info from before — convert it into
            organized facts the AI can use precisely.
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await structureExistingInfoAction();
                setMessage(r.message);
              })
            }
          >
            {pending ? "Structuring…" : "Structure my existing info"}
          </Button>
          {message && (
            <p className="w-full text-sm text-neutral-500">{message}</p>
          )}
        </Card>
      )}

      {grouped.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="No knowledge yet"
          description="Add facts here, run the questionnaire, or just let the AI ask you as questions come in."
        />
      ) : (
        grouped.map((g) => (
          <section key={g.value}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
              {LABEL_BY_VALUE[g.value]} · {g.facts.length}
            </h3>
            <ul className="flex flex-col gap-2">
              {g.facts.map((f) => (
                <FactRow key={f.id} f={f} canEdit={canEdit} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

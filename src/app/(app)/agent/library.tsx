"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BookOpen,
  Check,
  Copy,
  Download,
  FileText,
  ListChecks,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  addFactAction,
  archiveFactAction,
  archiveFactsAction,
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

function FactRow({
  f,
  canEdit,
  selected,
  onToggle,
}: {
  f: LibraryFact;
  canEdit: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
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
    <li
      className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${selected ? "border-brand-300 bg-brand-50/40" : "border-neutral-100 bg-white"}`}
    >
      {canEdit && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select fact: ${f.fact.slice(0, 60)}`}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600 sm:mt-1 sm:h-4 sm:w-4"
        />
      )}
      <div className="min-w-0 flex-1">
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

/** Plain-text fact sheet (grouped) — what Copy / Download emit. */
export function buildFactSheetText(facts: LibraryFact[]): string {
  const parts: string[] = [];
  for (const o of CATEGORY_OPTIONS) {
    const inCat = facts.filter((f) => f.category === o.value);
    if (inCat.length === 0) continue;
    parts.push(`${o.label.toUpperCase()}`);
    for (const f of inCat) {
      parts.push(`- ${f.fact}${f.condition ? ` (only: ${f.condition})` : ""}`);
    }
    parts.push("");
  }
  return parts.join("\n").trim();
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
  const { toast } = useToast();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<"manage" | "sheet">("manage");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();

  const grouped = CATEGORY_OPTIONS.map((o) => ({
    ...o,
    facts: facts.filter((f) => f.category === o.value),
  })).filter((g) => g.facts.length > 0);

  const sheetText = useMemo(() => buildFactSheetText(facts), [facts]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCategory(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allIn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function archiveSelected() {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `Archive ${selected.size} fact${selected.size === 1 ? "" : "s"}? The AI stops using them immediately.`
      )
    ) {
      return;
    }
    startBulk(async () => {
      const res = await archiveFactsAction([...selected]);
      toast({ description: res.message, tone: res.ok ? "success" : "error" });
      if (res.ok) setSelected(new Set());
    });
  }

  function copySheet() {
    void navigator.clipboard
      .writeText(sheetText)
      .then(() => toast({ description: "Fact sheet copied.", tone: "success" }))
      .catch(() => toast({ description: "Couldn't copy — select and copy manually.", tone: "error" }));
  }

  function downloadSheet() {
    const blob = new Blob([sheetText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fact-sheet.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const viewBtn = (v: "manage" | "sheet") =>
    `inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium sm:min-h-0 ${view === v ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`;

  if (view === "sheet") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <button type="button" className={viewBtn("manage")} onClick={() => setView("manage")}>
              <ListChecks className="h-4 w-4" /> Manage
            </button>
            <button type="button" className={viewBtn("sheet")} onClick={() => setView("sheet")}>
              <FileText className="h-4 w-4" /> Fact sheet
            </button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={copySheet}>
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
            <Button size="sm" variant="secondary" onClick={downloadSheet}>
              <Download className="h-3.5 w-3.5" /> Download .txt
            </Button>
          </div>
        </div>
        {grouped.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="No knowledge yet"
            description="Add facts in Manage view and the sheet builds itself."
          />
        ) : (
          <Card className="p-6">
            {grouped.map((g) => (
              <section key={g.value} className="mb-5 last:mb-0">
                <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
                  {g.label}
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  {g.facts.map((f) => (
                    <li key={f.id} className="text-sm text-neutral-800">
                      {f.fact}
                      {f.condition && (
                        <span className="text-neutral-500"> (only: {f.condition})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-400">
              {facts.length} facts — everything the AI is allowed to say about your business.
            </p>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        <button type="button" className={viewBtn("manage")} onClick={() => setView("manage")}>
          <ListChecks className="h-4 w-4" /> Manage
        </button>
        <button type="button" className={viewBtn("sheet")} onClick={() => setView("sheet")}>
          <FileText className="h-4 w-4" /> Fact sheet
        </button>
      </div>

      {canEdit && selected.size > 0 && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium text-brand-900">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" variant="danger" loading={bulkPending} onClick={archiveSelected}>
              <Trash2 className="h-3.5 w-3.5" /> Archive selected
            </Button>
          </div>
        </div>
      )}

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
        grouped.map((g) => {
          const ids = g.facts.map((f) => f.id);
          const allIn = ids.every((id) => selected.has(id));
          return (
            <section key={g.value}>
              <div className="mb-2 flex items-center gap-2">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => toggleCategory(ids)}
                    aria-label={`${allIn ? "Deselect" : "Select"} all in ${LABEL_BY_VALUE[g.value]}`}
                    className={`relative grid h-4 w-4 place-items-center rounded border before:absolute before:-inset-3 before:content-[''] ${allIn ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-300 bg-white text-transparent"}`}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                )}
                <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                  {LABEL_BY_VALUE[g.value]} · {g.facts.length}
                </h3>
              </div>
              <ul className="flex flex-col gap-2">
                {g.facts.map((f) => (
                  <FactRow
                    key={f.id}
                    f={f}
                    canEdit={canEdit}
                    selected={selected.has(f.id)}
                    onToggle={() => toggle(f.id)}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

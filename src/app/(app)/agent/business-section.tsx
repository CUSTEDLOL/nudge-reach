"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { VERTICALS, isVertical } from "@/modules/dashboard/verticals";
import { saveBusinessBasicsAction } from "./setup-actions";

/**
 * Who the AI says it is: name, what the business does, and the voice it uses.
 *
 * It is the first section of Training and it collapses to one line the moment
 * there is a name to show — an owner who has answered this once should never
 * have to scroll past it again. The same section serves the free trial and the
 * full app; its copy therefore names no industry.
 */
export function BusinessSection({
  businessName,
  vertical,
  tone,
  canEdit,
}: {
  businessName: string;
  /** A `VERTICALS` token ("real_estate") — what the prompt's curated
   *  templates are keyed by, so it is picked, never typed. */
  vertical: string;
  tone: string;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  // Open on the first visit (nothing saved), closed ever after. Closed also
  // means absent from the DOM, not merely hidden.
  const [editing, setEditing] = useState(canEdit && !businessName);
  const [name, setName] = useState(businessName);
  const [type, setType] = useState(vertical);
  const [voice, setVoice] = useState(tone);

  function save() {
    start(async () => {
      const r = await saveBusinessBasicsAction({
        businessName: name,
        vertical: type,
        tone: voice,
      });
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
      if (r.ok) setEditing(false);
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900">
            Your business
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Who your AI says it is when it answers.
          </p>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="mt-4 flex flex-col gap-4">
          <Field label="Business name" htmlFor="business-name" required>
            <Input
              id="business-name"
              value={name}
              disabled={pending}
              placeholder="Spice Garden"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            label="What you do"
            htmlFor="business-vertical"
            hint="Your AI introduces itself with this, and answers the questions this kind of business gets asked."
          >
            <Select
              id="business-vertical"
              value={type}
              disabled={pending}
              onChange={(e) => setType(e.target.value)}
            >
              {/* A stored vertical that predates this list (or came from the
                  older setup form) is offered as itself: a select with no
                  matching option submits its FIRST one, which would silently
                  relabel the business on the next save. */}
              {type && !isVertical(type) && (
                <option value={type}>{asWords(type)}</option>
              )}
              {VERTICALS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tone" htmlFor="business-tone">
            <Input
              id="business-tone"
              value={voice}
              disabled={pending}
              placeholder="Warm, friendly, and concise"
              onChange={(e) => setVoice(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              loading={pending}
              disabled={!name.trim()}
              onClick={save}
            >
              Save
            </Button>
            {businessName && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setName(businessName);
                  setType(vertical);
                  setVoice(tone);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-700">
          {summarise(businessName, vertical, tone)}
        </p>
      )}
    </Card>
  );
}

/** "real_estate" → "real estate", for a token the taxonomy no longer lists. */
function asWords(vertical: string): string {
  return vertical.replace(/_/g, " ").trim();
}

/** The taxonomy's own label, so the summary reads back what was picked. */
function labelFor(vertical: string): string {
  return (
    VERTICALS.find((v) => v.value === vertical)?.label ?? asWords(vertical)
  );
}

function summarise(
  businessName: string,
  vertical: string,
  tone: string,
): string {
  const parts = [businessName, labelFor(vertical), tone].filter(
    (part) => part.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(" · ") : "Nothing saved yet.";
}

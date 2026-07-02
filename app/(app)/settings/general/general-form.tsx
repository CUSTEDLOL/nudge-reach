"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { saveGeneralSettingsAction, type ActionResult } from "./actions";

const VERTICALS: { value: string; label: string }[] = [
  { value: "boutique", label: "Boutique / Fashion" },
  { value: "retail", label: "Shop / Retail" },
  { value: "restaurant", label: "Restaurant / Café" },
  { value: "grocery", label: "Grocery / Kirana" },
  { value: "electronics", label: "Electronics" },
  { value: "clinic", label: "Clinic / Salon" },
  { value: "real_estate", label: "Real estate" },
  { value: "other", label: "Other" },
];

export interface GeneralFormValues {
  name: string;
  vertical: string;
  avgOrderValueInr: number;
}

export function GeneralForm({ initial }: { initial: GeneralFormValues }) {
  const { toast } = useToast();
  const [, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await saveGeneralSettingsAction(formData);
      toast({
        description: result.message,
        tone: result.ok ? "success" : "error",
      });
      return result;
    },
    null
  );

  const options =
    initial.vertical && !VERTICALS.some((v) => v.value === initial.vertical)
      ? [{ value: initial.vertical, label: initial.vertical }, ...VERTICALS]
      : VERTICALS;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field
        label="Workspace name"
        htmlFor="org-name"
        required
        hint="Shown across the app and in the sidebar."
      >
        <Input
          id="org-name"
          name="name"
          defaultValue={initial.name}
          required
          placeholder="Sharma Boutique"
        />
      </Field>

      <Field
        label="Business vertical"
        htmlFor="org-vertical"
        hint="Helps tailor campaign suggestions and the AI agent."
      >
        <Select
          id="org-vertical"
          name="vertical"
          defaultValue={initial.vertical}
        >
          <option value="">Not set</option>
          {options.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Average order value"
        htmlFor="org-aov"
        hint="Used for the estimated “revenue influenced” metric on your dashboard."
      >
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400"
            aria-hidden
          >
            ₹
          </span>
          <Input
            id="org-aov"
            name="avgOrderValueInr"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            defaultValue={initial.avgOrderValueInr}
            className="pl-7"
          />
        </div>
      </Field>

      <div>
        <Button type="submit" loading={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

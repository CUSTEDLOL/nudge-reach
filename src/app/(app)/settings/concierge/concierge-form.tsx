"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { VERTICALS } from "@/modules/dashboard/verticals";
import { saveConciergeSetupAction } from "./actions";

export interface ConciergeDefaults {
  businessName: string;
  vertical: string;
  tone: string;
  doNots: string;
  hours: string;
  location: string;
  services: string;
  prices: string;
  policies: string;
  faqs: string;
}

export function ConciergeForm({ defaults }: { defaults: ConciergeDefaults }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [vertical, setVertical] = useState(defaults.vertical);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveConciergeSetupAction(fd);
      toast({
        title: r.ok ? "Client set up" : "Setup incomplete",
        description: r.message,
        tone: r.ok ? "success" : "error",
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business name" htmlFor="businessName" required>
          <Input
            id="businessName"
            name="businessName"
            defaultValue={defaults.businessName}
            placeholder="Your business name"
          />
        </Field>
        <Field label="Business type" htmlFor="vertical">
          <Select
            id="vertical"
            name="vertical"
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
          >
            {!VERTICALS.some((v) => v.value === vertical) && (
              <option value={vertical}>{vertical}</option>
            )}
            {VERTICALS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Opening hours" htmlFor="hours" required>
          <Textarea
            id="hours"
            name="hours"
            rows={3}
            defaultValue={defaults.hours}
            placeholder={"Mon–Sat 10am–8pm\nSun closed"}
          />
        </Field>
        <Field label="Location" htmlFor="location">
          <Textarea
            id="location"
            name="location"
            rows={3}
            defaultValue={defaults.location}
            placeholder="Shop 4, MG Road, Bengaluru"
          />
        </Field>
      </div>

      <Field label="Services offered" htmlFor="services" required>
        <Textarea
          id="services"
          name="services"
          rows={4}
          defaultValue={defaults.services}
          placeholder={"What you sell or do, one per line"}
        />
      </Field>

      <Field label="Prices" htmlFor="prices">
        <Textarea
          id="prices"
          name="prices"
          rows={4}
          defaultValue={defaults.prices}
          placeholder={"Basic plan ₹999/month\nSetup from ₹4,999"}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Booking & policies"
          htmlFor="policies"
          hint="Deposits, cancellations, walk-ins"
        >
          <Textarea
            id="policies"
            name="policies"
            rows={3}
            defaultValue={defaults.policies}
            placeholder="24h notice to cancel or reschedule."
          />
        </Field>
        <Field label="FAQs" htmlFor="faqs" hint="Common questions + answers">
          <Textarea
            id="faqs"
            name="faqs"
            rows={3}
            defaultValue={defaults.faqs}
            placeholder={"Q: Do you deliver?\nA: Yes, across the city."}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tone of voice" htmlFor="tone">
          <Input
            id="tone"
            name="tone"
            defaultValue={defaults.tone}
            placeholder="Warm, friendly, and concise"
          />
        </Field>
        <Field label="Do NOT do" htmlFor="doNots" hint="Hard boundaries for the agent">
          <Input
            id="doNots"
            name="doNots"
            defaultValue={defaults.doNots}
            placeholder="Never promise discounts over 20%"
          />
        </Field>
      </div>

      <div>
        <Button type="submit" loading={pending}>
          Set up this client
        </Button>
      </div>
    </form>
  );
}

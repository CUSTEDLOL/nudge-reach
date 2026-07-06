"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
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
            placeholder="Glow Skin Clinic"
          />
        </Field>
        <Field label="Vertical" htmlFor="vertical">
          <Select
            id="vertical"
            name="vertical"
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
          >
            <option value="clinic">Clinic / Health</option>
            <option value="salon">Salon / Beauty</option>
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
          placeholder={"Haircut & styling\nHair colour\nFacial\nManicure / pedicure"}
        />
      </Field>

      <Field label="Prices" htmlFor="prices">
        <Textarea
          id="prices"
          name="prices"
          rows={4}
          defaultValue={defaults.prices}
          placeholder={"Haircut ₹400\nHair colour from ₹1,500\nFacial from ₹900"}
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
            placeholder="Appointments preferred. 24h notice to reschedule."
          />
        </Field>
        <Field label="FAQs" htmlFor="faqs" hint="Common questions + answers">
          <Textarea
            id="faqs"
            name="faqs"
            rows={3}
            defaultValue={defaults.faqs}
            placeholder={"Q: Do you take walk-ins?\nA: Yes, subject to availability."}
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
            placeholder="Never quote medical advice or discounts over 20%"
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

"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { ArrowRight, CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Intent = "demo" | "waitlist";

const CATEGORIES = [
  "Apparel & textiles",
  "Jewellery",
  "Home décor & gifting",
  "Bakery & food",
  "Beauty & wellness",
  "Electronics",
  "D2C / online brand",
  "Services",
  "Other",
];

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] text-ink shadow-sm outline-none transition-colors placeholder:text-ink/35 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export function LeadForm({
  surface = "home",
  defaultIntent = "demo",
}: {
  surface?: string;
  defaultIntent?: Intent;
}) {
  const [intent, setIntent] = useState<Intent>(defaultIntent);
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const form = e.currentTarget;
    const payload = {
      shopName: (form.elements.namedItem("shopName") as HTMLInputElement).value,
      city: (form.elements.namedItem("city") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
      vertical: (form.elements.namedItem("vertical") as HTMLSelectElement).value,
      source: `${surface}:${intent}`,
    };

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setError("Network error. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center rounded-3xl border border-brand-200 bg-white p-8 text-center shadow-lift"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-brand-600">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h3 className="mt-4 text-xl font-semibold text-ink">You&apos;re in! 🎉</h3>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink/60">
          {intent === "demo"
            ? "We'll WhatsApp you within one business day to schedule your demo and set up your first campaign — free."
            : "You're on the waitlist. We'll WhatsApp you shortly to set up your first campaign — free."}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-lift sm:p-7">
      {/* intent toggle */}
      <div className="mb-5 inline-flex rounded-full border border-black/5 bg-brand-50/70 p-1">
        {(["demo", "waitlist"] as Intent[]).map((it) => (
          <button
            key={it}
            type="button"
            onClick={() => setIntent(it)}
            className={cn(
              "relative rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors",
              intent === it ? "text-white" : "text-ink/60 hover:text-ink"
            )}
          >
            {intent === it && (
              <motion.span
                layoutId={`intent-${surface}`}
                className="absolute inset-0 rounded-full bg-brand-500 shadow-soft"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative">
              {it === "demo" ? "Book a demo" : "Join waitlist"}
            </span>
          </button>
        ))}
      </div>

      <form className="flex flex-col gap-3.5" onSubmit={onSubmit}>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Business name">
            <input name="shopName" required placeholder="e.g. Meera Sarees" className={inputClass} />
          </Field>
          <Field label="City">
            <input name="city" required placeholder="e.g. Jaipur" className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="WhatsApp number">
            <input
              name="phone"
              type="tel"
              required
              placeholder="+91 98xxxxxxxx"
              className={inputClass}
            />
          </Field>
          <Field label="What do you sell?">
            <select name="vertical" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Choose…
              </option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <button
          type="submit"
          disabled={status === "submitting"}
          className="group mt-1 inline-flex h-[3.35rem] items-center justify-center gap-2 rounded-xl bg-brand-500 text-base font-semibold text-white shadow-[0_12px_30px_-10px_rgba(6,193,103,0.7)] transition-all duration-300 hover:bg-brand-600 hover:shadow-glow disabled:opacity-70"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Sending…
            </>
          ) : intent === "demo" ? (
            <>
              <CalendarCheck className="h-5 w-5" /> Book my demo
            </>
          ) : (
            <>
              Join the waitlist — first campaign free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>

        {error ? (
          <p className="text-center text-[13px] font-medium text-red-600">{error}</p>
        ) : (
          <p className="text-center text-[12.5px] text-ink/45">
            We onboard businesses one by one. No spam, no credit card — we&apos;ll
            WhatsApp you to set things up.
          </p>
        )}
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ink/60">{label}</span>
      {children}
    </label>
  );
}

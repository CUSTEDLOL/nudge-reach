"use client";

import { useState } from "react";

import {
  calculateLeadLeakage,
  type LeadLeakageInputs,
} from "@/modules/marketing/lead-leakage";

type InputValues = Record<keyof LeadLeakageInputs, string>;

interface LeadLeakageCalculatorProps {
  initialValues?: Partial<InputValues>;
}

const EMPTY_VALUES: InputValues = {
  monthlyLeads: "",
  missedReplyPercent: "",
  missingFollowupPercent: "",
  conversionPercent: "",
  averageSaleValue: "",
};

const INPUTS = [
  {
    key: "monthlyLeads",
    id: "monthly-leads",
    label: "Monthly WhatsApp leads",
    hint: "How many new enquiries normally start on WhatsApp each month?",
    suffix: "leads",
  },
  {
    key: "missedReplyPercent",
    id: "missed-reply-percent",
    label: "Leads without a timely reply (%)",
    hint: "Your estimate of enquiries that receive no useful reply in time.",
    suffix: "%",
    max: 100,
  },
  {
    key: "missingFollowupPercent",
    id: "missing-followup-percent",
    label: "Replied leads without follow-up (%)",
    hint: "Among leads that received a reply, how many get no next follow-up?",
    suffix: "%",
    max: 100,
  },
  {
    key: "conversionPercent",
    id: "conversion-percent",
    label: "Lead-to-customer conversion rate (%)",
    hint: "Use the normal conversion rate for leads your team handles well.",
    suffix: "%",
    max: 100,
  },
  {
    key: "averageSaleValue",
    id: "average-sale-value",
    label: "Average sale value",
    hint: "Enter the average value of one new customer in your local currency.",
    suffix: "value",
  },
] as const;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function validNumber(value: string, max?: number): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  if (max !== undefined && parsed > max) return null;
  return parsed;
}

function validationError(value: string, max?: number): string | null {
  if (value.trim() === "") return null;
  if (validNumber(value, max) !== null) return null;
  return max === 100
    ? "Enter a percentage from 0 to 100."
    : "Enter a non-negative number.";
}

function parsedInputs(values: InputValues): LeadLeakageInputs | null {
  const monthlyLeads = validNumber(values.monthlyLeads);
  const missedReplyPercent = validNumber(values.missedReplyPercent, 100);
  const missingFollowupPercent = validNumber(
    values.missingFollowupPercent,
    100,
  );
  const conversionPercent = validNumber(values.conversionPercent, 100);
  const averageSaleValue = validNumber(values.averageSaleValue);

  if (
    monthlyLeads === null ||
    missedReplyPercent === null ||
    missingFollowupPercent === null ||
    conversionPercent === null ||
    averageSaleValue === null
  ) {
    return null;
  }

  return {
    monthlyLeads,
    missedReplyPercent,
    missingFollowupPercent,
    conversionPercent,
    averageSaleValue,
  };
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function LeadLeakageCalculator({
  initialValues,
}: LeadLeakageCalculatorProps) {
  const [values, setValues] = useState<InputValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });
  const inputs = parsedInputs(values);
  const result = inputs ? calculateLeadLeakage(inputs) : null;
  const hasEnteredValue = Object.values(values).some(
    (value) => value.trim() !== "",
  );
  const hasValidationError = INPUTS.some(
    (input) =>
      validationError(
        values[input.key],
        "max" in input ? input.max : undefined,
      ) !== null,
  );
  const liveSummary = result
    ? `Estimate updated: ${formatCount(result.leadsAtRisk)} leads and ${inr.format(result.monthlyRevenueAtRisk)} monthly revenue at risk.`
    : hasEnteredValue && hasValidationError
      ? "Correct the highlighted values to calculate the estimate."
      : "Enter all five values to calculate the estimate.";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
      <fieldset className="rounded-[1.75rem] border-2 border-ink/70 bg-white p-6 sm:p-8">
        <legend className="px-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
          Your lead flow
        </legend>
        <div className="mt-2 space-y-6">
          {INPUTS.map((input) => {
            const error = validationError(
              values[input.key],
              "max" in input ? input.max : undefined,
            );
            const hintId = `${input.id}-hint`;
            const errorId = `${input.id}-error`;

            return (
              <div key={input.key}>
                <label
                  htmlFor={input.id}
                  className="block font-bold text-ink"
                >
                  {input.label}
                </label>
                <p id={hintId} className="mt-1 text-sm leading-6 text-ink/65">
                  {input.hint}
                </p>
                <div
                  className={`mt-2 flex items-center rounded-xl border bg-white focus-within:ring-2 ${
                    error
                      ? "border-red-400 focus-within:border-red-600 focus-within:ring-red-600/20"
                      : "border-ink/25 focus-within:border-brand-700 focus-within:ring-brand-700/25"
                  }`}
                >
                  <input
                    id={input.id}
                    name={input.key}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={"max" in input ? input.max : undefined}
                    step="any"
                    required
                    value={values[input.key]}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [input.key]: event.target.value,
                      }))
                    }
                    className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-ink outline-none"
                  />
                  <span className="pr-4 text-sm font-bold text-ink/55" aria-hidden="true">
                    {input.suffix}
                  </span>
                </div>
                {error ? (
                  <p id={errorId} className="mt-2 text-sm font-bold text-red-700">
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-6 border-t border-ink/15 pt-5 text-sm font-bold text-ink/70">
          No information entered here is stored
        </p>
      </fieldset>

      <div>
        <p className="sr-only" aria-live="polite">
          {liveSummary}
        </p>
        <section className="rounded-[1.75rem] bg-ink p-6 text-white shadow-[8px_8px_0_rgba(6,193,103,0.2)] sm:p-8">
          {result ? (
            <>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#9bf0bf]">
                Planning estimate
              </p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-white/65">Leads at risk each month</p>
                  <p className="mt-1 text-3xl font-black">
                    {formatCount(result.leadsAtRisk)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-white/65">Potential customers at risk</p>
                  <p className="mt-1 text-3xl font-black">
                    {formatCount(result.customersAtRisk)}
                  </p>
                </div>
                <div className="border-t border-white/20 pt-5 sm:col-span-2">
                  <p className="text-sm text-white/65">
                    Estimated monthly revenue at risk
                  </p>
                  <p className="mt-1 break-words text-3xl font-black text-[#9bf0bf] sm:text-4xl">
                    {inr.format(result.monthlyRevenueAtRisk)}
                  </p>
                </div>
                <div className="border-t border-white/20 pt-5 sm:col-span-2">
                  <p className="text-sm text-white/65">
                    Estimated annual revenue at risk
                  </p>
                  <p className="mt-1 break-words text-2xl font-black">
                    {inr.format(result.annualRevenueAtRisk)}
                  </p>
                </div>
              </div>
              <div className="mt-7 border-t border-white/20 pt-6 text-sm leading-6 text-white/70">
                <p>
                  Of the leads at risk, {formatCount(result.missedReplyLeads)} are
                  estimated to miss a timely reply and {formatCount(result.missingFollowupLeads)}
                  {" "}to miss follow-up after a reply.
                </p>
                {result.calculationCapped ? (
                  <p className="mt-4 rounded-xl border border-[#9bf0bf]/50 bg-white/10 p-4 font-bold text-white">
                    One or more values reached JavaScript&apos;s numeric/precision
                    limit. Treat this result as a limit rather than an exact
                    estimate.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex min-h-72 flex-col justify-center">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#9bf0bf]">
                Your estimate will appear here
              </p>
              <h2 className="mt-4 text-2xl font-black sm:text-3xl">
                Enter all five values to see where leads may be leaking.
              </h2>
              <p className="mt-4 max-w-md leading-7 text-white/70">
                Use realistic monthly averages. The calculator waits until every
                field contains a valid non-negative value.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

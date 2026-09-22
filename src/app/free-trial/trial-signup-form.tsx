"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  captureAttribution,
  pushMarketingEvent,
} from "@/modules/marketing/analytics";
import {
  completeTrialAccountHandoff,
  trialClaimNeedsRefresh,
  trialIntakePayload,
  validateTrialPassword,
  type TrialAccountResponse,
  type TrialIntakeResponse,
  type TrialClaimResponse,
  type TrialSignupValues,
} from "@/modules/trial/browser-signup";

const INITIAL_VALUES: TrialSignupValues = {
  ownerName: "",
  businessName: "",
  email: "",
  phone: "",
  password: "",
  contactConsent: false,
  honeypot: "",
};

type FailureReason = "validation" | "intake" | "auth";

export function TrialSignupForm() {
  const router = useRouter();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<TrialClaimResponse | null>(null);

  function update(event: ChangeEvent<HTMLInputElement>) {
    const { name, type, checked, value } = event.currentTarget;
    setValues((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function fail(reason: FailureReason, text: string) {
    pushMarketingEvent({
      event: "trial_signup_failed",
      surface: "free_trial",
      reason,
    });
    setMessage(text);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setDuplicate(false);

    const passwordError = validateTrialPassword(values.password);
    if (passwordError || !values.contactConsent) {
      fail(
        "validation",
        passwordError ?? "Please agree that Nudge may contact you about this trial.",
      );
      return;
    }

    setBusy(true);
    let claim = pendingClaim;
    if (claim && trialClaimNeedsRefresh(claim)) {
      claim = null;
      setPendingClaim(null);
    }
    try {
      if (!claim) {
        const attribution = captureAttribution(
          new URL(window.location.href),
          document.referrer,
          window.localStorage,
          document.cookie,
        );
        pushMarketingEvent({
          event: "trial_signup_started",
          surface: "free_trial",
        });

        const response = await fetch("/api/trials", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(trialIntakePayload(values, attribution)),
        });
        const result = (await response.json()) as TrialIntakeResponse;
        if (!response.ok || !result.ok) {
          setDuplicate(response.status === 409);
          fail(
            "intake",
            response.status === 409
              ? "A trial already exists—sign in to continue."
              : result.ok
                ? "Couldn't start the trial. Please try again."
                : result.error,
          );
          return;
        }
        claim = result.claim;
        setPendingClaim(claim);
      }

      const handoff = await completeTrialAccountHandoff(values, claim, {
        createAccount: async (payload) => {
          const response = await fetch("/api/trials/account", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          return {
            status: response.status,
            ok: response.ok,
            result: (await response.json()) as TrialAccountResponse,
          };
        },
        signInWithPassword: async (credentials) => {
          const { data, error } = await createClient().auth.signInWithPassword(
            credentials,
          );
          return { data: { session: data.session }, error };
        },
      });
      if (!handoff.destination) {
        setDuplicate(handoff.showSignIn);
        fail("auth", handoff.message);
        return;
      }

      pushMarketingEvent({
        event: "trial_signup_completed",
        surface: "free_trial",
      });
      setPendingClaim(null);
      setValues((current) => ({ ...current, password: "" }));

      router.push(handoff.destination);
      router.refresh();
    } catch {
      if (claim) setDuplicate(true);
      fail(
        claim ? "auth" : "intake",
        claim
          ? "Your trial details are saved, but secure account creation was interrupted. Please retry."
          : "Couldn't start the trial. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Your name"
          name="ownerName"
          value={values.ownerName}
          onChange={update}
          autoComplete="name"
          placeholder="Asha Mehta"
          disabled={Boolean(pendingClaim)}
        />
        <Field
          label="Business name"
          name="businessName"
          value={values.businessName}
          onChange={update}
          autoComplete="organization"
          placeholder="Cedar Studio"
          disabled={Boolean(pendingClaim)}
        />
      </div>
      <Field
        label="Work email"
        name="email"
        value={values.email}
        onChange={update}
        type="email"
        autoComplete="email"
        placeholder="you@business.com"
        disabled={Boolean(pendingClaim)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Mobile with country code"
          name="phone"
          value={values.phone}
          onChange={update}
          type="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          disabled={Boolean(pendingClaim)}
        />
        <Field
          label="Create a password"
          name="password"
          value={values.password}
          onChange={update}
          type="password"
          autoComplete="new-password"
          placeholder="8+ characters"
          minLength={8}
          maxLength={128}
        />
      </div>

      <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="trial-company-site">Company website (leave blank)</label>
        <input
          id="trial-company-site"
          name="honeypot"
          value={values.honeypot}
          onChange={update}
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-ink/65">
        <input
          name="contactConsent"
          type="checkbox"
          checked={values.contactConsent}
          onChange={update}
          disabled={Boolean(pendingClaim)}
          required
          className="mt-0.5 h-4 w-4 rounded border-ink/25 accent-brand-600"
        />
        <span>
          I agree that Nudge may contact me about this trial and setup help.
          I can opt out at any time.
        </span>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-brand-700 px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : null}
        {busy
          ? "Creating your workspace…"
          : pendingClaim
            ? "Retry secure account creation"
            : "Create my workspace"}
      </button>

      <div aria-live="polite" className="min-h-6 text-sm text-red-700">
        {message}
        {duplicate ? (
          <>
            {" "}
            <Link href="/login" className="font-semibold underline underline-offset-2">
              Sign in
            </Link>
          </>
        ) : null}
      </div>

      <p className="text-xs leading-5 text-ink/60">
        Your workspace opens immediately. We will also email you an optional link
        to verify the address for account recovery.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: {
  label: string;
  name: keyof TrialSignupValues;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  return (
    <label className="block text-sm font-semibold text-ink">
      <span>{label}</span>
      <input
        {...props}
        name={name}
        required
        className="mt-1.5 h-12 w-full rounded-md border border-ink/20 bg-white px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink/60 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10"
      />
    </label>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import {
  completeOwnerSetupAction,
  type OwnerSetupActionState,
} from "@/app/invite/[token]/actions";

const INITIAL_STATE: OwnerSetupActionState = { status: "idle", message: "" };

export function OwnerSetupForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    completeOwnerSetupAction,
    INITIAL_STATE
  );
  const accountReady =
    state.status === "existing_account" || state.status === "account_created";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <label className="block text-sm font-semibold text-neutral-800">
        Your email
        <input
          type="email"
          value={email}
          readOnly
          aria-readonly="true"
          className="mt-2 h-12 w-full cursor-not-allowed rounded-xl border border-neutral-200 bg-neutral-100 px-4 text-base text-neutral-600 outline-none"
        />
        <span className="mt-1.5 block text-xs font-normal leading-5 text-neutral-500">
          This workspace is reserved for this email address.
        </span>
      </label>

      <label className="block text-sm font-semibold text-neutral-800">
        Create a password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          maxLength={1024}
          autoComplete="new-password"
          disabled={pending}
          className="mt-2 h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-950 outline-none transition-[border-color,box-shadow] focus:border-black focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-wait disabled:bg-neutral-100"
        />
        <span className="mt-1.5 block text-xs font-normal text-neutral-500">
          Use at least 8 characters.
        </span>
      </label>

      <label className="block text-sm font-semibold text-neutral-800">
        Confirm your password
        <input
          type="password"
          name="passwordConfirmation"
          required
          minLength={8}
          maxLength={1024}
          autoComplete="new-password"
          disabled={pending}
          className="mt-2 h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-950 outline-none transition-[border-color,box-shadow] focus:border-black focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-wait disabled:bg-neutral-100"
        />
      </label>

      <div aria-live="polite" className="min-h-6">
        {state.message ? (
          <p
            role={accountReady ? "status" : "alert"}
            className={`flex items-start gap-2 text-sm leading-5 ${
              accountReady ? "text-emerald-800" : "text-red-700"
            }`}
          >
            {accountReady ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            {state.message}
          </p>
        ) : null}
      </div>

      {accountReady ? (
        <Link
          href="/login"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white outline-none transition-opacity hover:opacity-85 focus-visible:ring-4 focus-visible:ring-emerald-500/30"
        >
          Sign in to continue
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white outline-none transition-opacity hover:opacity-85 focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-wait disabled:opacity-55"
        >
          <LockKeyhole className="h-4 w-4" aria-hidden />
          {pending ? "Setting up your account…" : "Set my password and continue"}
          {!pending ? (
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          ) : null}
        </button>
      )}

      <p className="text-center text-xs leading-5 text-neutral-400">
        Already set up your account?{" "}
        <Link href="/login" className="font-semibold text-neutral-700 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}


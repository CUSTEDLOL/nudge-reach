"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import {
  loginFounderAction,
  type FounderLoginState,
} from "@/app/admin/actions";

const INITIAL_STATE: FounderLoginState = { ok: false, message: "" };
const LOGO_W = 1570;
const LOGO_H = 334;

export function AdminLogin() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [state, formAction, pending] = useActionState(
    loginFounderAction,
    INITIAL_STATE
  );

  return (
    <div className="min-h-dvh bg-[#f3f5f2] px-4 py-6 text-neutral-950 sm:px-6 sm:py-10">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Image
          src="/logo-mark.png"
          alt="Nudge"
          width={LOGO_W}
          height={LOGO_H}
          priority
          unoptimized
          className="h-7 w-auto sm:h-8"
        />
        <span className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          Founder portal
        </span>
      </header>

      <main className="mx-auto grid min-h-[calc(100dvh-7rem)] w-full max-w-5xl place-items-center py-8 sm:py-12">
        <section className="grid w-full overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-[0_24px_70px_rgba(16,24,18,0.10)] md:grid-cols-[0.9fr_1.1fr]">
          <div className="flex min-h-64 flex-col bg-black p-7 text-white sm:p-10 md:min-h-[36rem]">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10">
              <LockKeyhole className="h-5 w-5" aria-hidden />
            </div>
            <div className="my-auto py-10">
              <h1 className="max-w-sm font-display text-4xl font-black leading-[1.02] tracking-[-0.04em] sm:text-5xl">
                Private access to the control room.
              </h1>
              <p className="mt-5 max-w-sm text-[15px] leading-7 text-white/65">
                Operate customer workspaces, monitor platform health, and act
                on issues from one founder-only surface.
              </p>
            </div>
            <p className="flex items-center gap-2 text-sm text-white/70">
              <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
              Restricted to approved founder accounts
            </p>
          </div>

          <div className="flex items-center p-7 sm:p-10 md:p-14">
            <div className="w-full">
              <h2 className="font-display text-3xl font-black tracking-[-0.03em]">
                Sign in
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
                Use your founder email and password. This session stays
                separate from your normal Nudge workspace.
              </p>

              <form action={formAction} className="mt-8 space-y-5">
                <label className="block text-sm font-semibold text-neutral-800">
                  Email
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={pending}
                    className="mt-2 h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-950 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/10 disabled:cursor-not-allowed disabled:bg-neutral-100"
                    placeholder="founder@nudgeagent.app"
                  />
                </label>

                <div className="text-sm font-semibold text-neutral-800">
                  <label htmlFor="founder-password">Password</label>
                  <div className="relative mt-2">
                    <input
                      id="founder-password"
                      type={passwordVisible ? "text" : "password"}
                      name="password"
                      required
                      autoComplete="current-password"
                      disabled={pending}
                      className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 pr-12 text-base font-normal text-neutral-950 outline-none transition-[border-color,box-shadow] focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/10 disabled:cursor-not-allowed disabled:bg-neutral-100"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPasswordVisible((visible) => !visible)
                      }
                      disabled={pending}
                      aria-label={
                        passwordVisible ? "Hide password" : "Show password"
                      }
                      aria-pressed={passwordVisible}
                      className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-neutral-500 outline-none transition-colors hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {passwordVisible ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                <div aria-live="polite" className="min-h-6">
                  {state.message ? (
                    <p
                      role="alert"
                      className="flex items-start gap-2 text-sm leading-5 text-red-700"
                    >
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden
                      />
                      {state.message}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={pending}
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white outline-none transition-opacity hover:opacity-85 focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-wait disabled:opacity-55"
                >
                  {pending ? "Signing in…" : "Sign in to founder portal"}
                  {!pending ? (
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  ) : null}
                </button>
              </form>

              <p className="mt-6 text-xs leading-5 text-neutral-400">
                Signing out here will not sign you out of your normal Nudge
                workspace.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

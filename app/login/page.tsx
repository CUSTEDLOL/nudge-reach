"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/marketing/logo";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[15px] text-ink shadow-sm outline-none transition-colors placeholder:text-ink/35 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function signUp() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setMessage("Almost there! Check your email and click the link to finish signing up.");
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-4 py-10">
      <div className="bg-dotgrid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink/55 transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-lift sm:p-8">
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-ink">
            Sign in to Nudge
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/55">
            Your inbox, campaigns and automations — one workspace. New here?
            Create an account free.
          </p>

          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void signIn();
            }}
          >
            <label className="block text-[13px] font-semibold text-ink/60">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@business.com"
              />
            </label>
            <label className="block text-[13px] font-semibold text-ink/60">
              Password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-[15px] font-semibold text-white shadow-[0_10px_26px_-10px_rgba(6,193,103,0.65)] transition-all duration-300 hover:bg-brand-600 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void signUp()}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-4 text-[15px] font-semibold text-ink shadow-sm transition-colors hover:border-black/20 hover:bg-black/[0.02] disabled:opacity-60"
            >
              Create a free account
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs font-medium text-ink/35">
            <div className="h-px flex-1 bg-black/8" />
            or
            <div className="h-px flex-1 bg-black/8" />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void signInWithGoogle()}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-black/10 bg-white px-4 text-[15px] font-semibold text-ink shadow-sm transition-colors hover:border-black/20 hover:bg-black/[0.02] disabled:opacity-60"
          >
            Continue with Google
          </button>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}
          {message && (
            <p className="mt-4 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
              {message}
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-[13px] text-ink/45">
          Free plan · No credit card · Official WhatsApp Cloud API
        </p>
      </div>
    </main>
  );
}

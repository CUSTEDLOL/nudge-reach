"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/marketing/logo";

const inputClass =
  "mt-1.5 w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

/** Landing page for the password-recovery email — the link signs the visitor
 * in via /auth/confirm, then this page lets them choose a new password. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "expired">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setState(data.session ? "ready" : "expired"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f5] px-4">
      <div className="w-full max-w-md rounded-3xl border-2 border-ink/10 bg-white p-8 shadow-[6px_6px_0_rgba(10,15,13,0.08)]">
        <Logo />
        <h1 className="mt-6 text-2xl font-black text-ink">Choose a new password</h1>

        {state === "checking" && (
          <p className="mt-4 text-sm text-ink/60">Checking your link…</p>
        )}

        {state === "expired" && (
          <div className="mt-4 text-sm text-ink/70">
            <p>
              This reset link has expired or was already used. Request a fresh one
              from the sign-in page.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white"
            >
              Back to sign in
            </Link>
          </div>
        )}

        {state === "ready" && (
          <form className="mt-5 flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
            <label className="block text-[13px] font-bold text-ink/60">
              New password
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 6 characters"
              />
            </label>
            <label className="block text-[13px] font-bold text-ink/60">
              Confirm password
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
                placeholder="Same again"
              />
            </label>
            {error && (
              <p className="rounded-xl border-2 border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-500 px-4 text-[15px] font-bold text-white shadow-[0_4px_0_#047f48] transition-all hover:bg-brand-400 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save new password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

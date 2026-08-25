"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, LogIn, Mail, UserRoundPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/marketing/logo";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* The left panel's rotating shift report — one card per night agent,  */
/* same cast as the landing page's Night Shift chapters.               */
/* ------------------------------------------------------------------ */
const SLIDES = [
  {
    agent: "Sales agent",
    time: "12:31 AM",
    headline: "It answers while you sleep.",
    line: "Every question, in seconds — your prices, your tone.",
  },
  {
    agent: "Booking agent",
    time: "2:15 AM",
    headline: "It books the real calendar.",
    line: "Checks availability, locks the slot, sends the reminder.",
  },
  {
    agent: "Follow-up agent",
    time: "4:40 AM",
    headline: "It chases the quiet leads.",
    line: "The ones who read your message and vanished — recovered.",
  },
  {
    agent: "Payment agent",
    time: "6:48 AM",
    headline: "It collects the deposit.",
    line: "Payment link sent, ₹500 received before breakfast.",
  },
];

const SLIDE_MS = 4500;

// The Google button only renders once the provider is enabled in Supabase —
// otherwise every click fails with "provider is not enabled".
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "1";

type Mode = "signin" | "signup" | "reset";

const inputClass =
  "mt-1.5 w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

/** Official multicolour Google "G". */
function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.87 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function LoginClient({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const [slide, setSlide] = useState(0);

  // The shift report rotates on its own; the dots let you jump.
  useEffect(() => {
    const id = setInterval(() => {
      setSlide((s) => (s + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => clearInterval(id);
  }, [slide]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

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
    setError(null);
    setMessage(null);
    if (!email.trim() || password.length < 6) {
      setError(
        "Enter your email and a password (at least 6 characters), then tap Create free account."
      );
      return;
    }
    setBusy(true);
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
      setError(
        error.message.toLowerCase().includes("invalid")
          ? "That email address was rejected — use a real inbox you can open (fake/test domains don't work)."
          : error.message
      );
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setMessage(
      "Almost there! Check your email and click the link to finish signing up."
    );
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

  async function resetPassword() {
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError("Enter the email you signed up with.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/reset`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMessage("Check your email — the reset link is on its way.");
  }

  const active = SLIDES[slide];
  const showGoogle = mode !== "reset" && GOOGLE_ENABLED;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#faf9f5]">
      <div className="bg-dotgrid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[110rem] lg:grid-cols-[1.15fr_1fr]">
        {/* ---- left: the park, framed like a bento card ---- */}
        <aside className="hidden p-6 lg:block lg:p-8" aria-hidden>
          <div className="relative h-full overflow-hidden rounded-[2rem] border-2 border-ink/70 shadow-[9px_9px_0_rgba(10,15,13,0.82)]">
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/hero/park-cta-v2.jpg"
              className="absolute inset-0 h-full w-full object-cover"
            >
              <source src="/hero/park-cta-v2.mp4" type="video/mp4" />
            </video>
            {/* legibility grade — sky-deep at the top, clear ground below */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(9,40,74,0.55) 0%, rgba(9,40,74,0.28) 34%, rgba(9,40,74,0.05) 60%, rgba(9,40,74,0.25) 100%)",
              }}
            />

            {/* the rotating shift report */}
            <div className="absolute inset-x-0 top-0 flex flex-col items-center px-10 pt-14 text-center">
              <span
                key={`chip-${slide}`}
                className="inline-flex animate-rise items-center gap-2 rounded-full border-2 border-ink/70 bg-white px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-brand-700 shadow-[3px_3px_0_rgba(10,15,13,0.82)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                {active.agent} · {active.time}
              </span>
              <h2
                key={`head-${slide}`}
                className="mt-5 max-w-lg animate-rise font-display text-[clamp(1.9rem,2.6vw,2.7rem)] font-black leading-[1.04] tracking-[-0.03em] text-white [animation-delay:60ms]"
                style={{
                  textShadow: "0 2px 10px rgba(9,40,74,0.55), 0 10px 44px rgba(9,40,74,0.45)",
                }}
              >
                {active.headline}
              </h2>
              <p
                key={`line-${slide}`}
                className="mt-3 max-w-md animate-rise text-[15.5px] font-medium leading-relaxed text-white/90 [animation-delay:120ms]"
                style={{ textShadow: "0 2px 12px rgba(9,40,74,0.6)" }}
              >
                {active.line}
              </p>
            </div>

            {/* dots */}
            <div className="absolute inset-x-0 bottom-7 flex justify-center gap-2.5">
              {SLIDES.map((s, i) => (
                <button
                  key={s.time}
                  type="button"
                  aria-label={`Show ${s.agent}`}
                  onClick={() => setSlide(i)}
                  className={cn(
                    "h-2.5 rounded-full border border-ink/40 transition-all duration-300",
                    i === slide ? "w-7 bg-white" : "w-2.5 bg-white/55 hover:bg-white/80"
                  )}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* ---- right: the door in ---- */}
        <section className="relative flex flex-col px-6 py-8 sm:px-10 lg:px-14">
          <div className="flex items-center justify-between">
            <Logo />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink/55 transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
            <h1 className="text-center font-display text-[1.9rem] font-black tracking-[-0.02em] text-ink">
              {mode === "signin"
                ? "Welcome back."
                : mode === "reset"
                  ? "Reset your password."
                  : "Let's run your WhatsApp."}
            </h1>
            <p className="mt-2 text-center text-[14.5px] leading-relaxed text-ink/55">
              {mode === "signin"
                ? "Your front desk kept the seat warm."
                : mode === "reset"
                  ? "We'll email you a link to choose a new one."
                  : "Free plan, no card — live the same day."}
            </p>

            {/* Sign In / Sign Up segmented toggle */}
            <div
              role="tablist"
              aria-label="Sign in or sign up"
              className="mx-auto mt-7 inline-flex items-center rounded-full border-2 border-ink/15 bg-white p-1"
            >
              {(
                [
                  { value: "signin", label: "Sign In", icon: LogIn },
                  { value: "signup", label: "Sign Up", icon: UserRoundPlus },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={mode === opt.value}
                  onClick={() => switchMode(opt.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13.5px] font-bold transition-all duration-200",
                    mode === opt.value
                      ? "bg-ink text-white shadow-[2px_2px_0_rgba(10,15,13,0.25)]"
                      : "text-ink/50 hover:text-ink"
                  )}
                >
                  <opt.icon className="h-3.5 w-3.5" aria-hidden />
                  {opt.label}
                </button>
              ))}
            </div>

            {showGoogle && (
              <>
            {/* Google first — the fastest door */}
            <button
              type="button"
              disabled={busy}
              onClick={() => void signInWithGoogle()}
              className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border-2 border-ink/70 bg-ink text-[15px] font-bold text-white shadow-[4px_4px_0_rgba(10,15,13,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_rgba(10,15,13,0.35)] active:translate-y-0 active:shadow-[2px_2px_0_rgba(10,15,13,0.35)] disabled:opacity-60"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white">
                <GoogleG />
              </span>
              {mode === "signin" ? "Sign in with Google" : "Sign up with Google"}
            </button>

            <div className="my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/35">
              <div className="h-px flex-1 bg-ink/10" />
              or
              <div className="h-px flex-1 bg-ink/10" />
            </div>
              </>
            )}

            {mode === "reset" ? (
              <form
                className="mt-7 flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void resetPassword();
                }}
              >
                <label className="block text-[13px] font-bold text-ink/60">
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
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-500 px-4 text-[15px] font-bold text-white shadow-[0_4px_0_#047f48] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-400 hover:shadow-[0_6px_0_#047f48] active:translate-y-0 active:shadow-[0_2px_0_#047f48] disabled:pointer-events-none disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Email me a reset link
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="text-center text-[12.5px] font-semibold text-ink/50 transition-colors hover:text-ink"
                >
                  Back to sign in
                </button>
              </form>
            ) : (
            <form
              className={cn("flex flex-col gap-4", !showGoogle && "mt-7")}
              onSubmit={(e) => {
                e.preventDefault();
                void (mode === "signin" ? signIn() : signUp());
              }}
            >
              <label className="block text-[13px] font-bold text-ink/60">
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
              <label className="block text-[13px] font-bold text-ink/60">
                Password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                />
              </label>

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className="-mt-1 self-end text-[12.5px] font-semibold text-ink/50 underline-offset-2 transition-colors hover:text-ink hover:underline"
                >
                  Forgot password?
                </button>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-500 px-4 text-[15px] font-bold text-white shadow-[0_4px_0_#047f48] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-400 hover:shadow-[0_6px_0_#047f48] active:translate-y-0 active:shadow-[0_2px_0_#047f48] disabled:pointer-events-none disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" ? (
                  "Sign in"
                ) : (
                  <>
                    <Mail className="h-4 w-4" aria-hidden />
                    Create free account
                  </>
                )}
              </button>
            </form>
            )}

            {error && (
              <p className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}
            {message && (
              <p className="mt-4 rounded-xl border-2 border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
                {message}
              </p>
            )}

            <p className="mt-7 text-center text-[12.5px] leading-relaxed text-ink/45">
              By continuing you agree to our{" "}
              <Link href="/privacy" className="font-semibold underline underline-offset-2 hover:text-ink">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="font-semibold underline underline-offset-2 hover:text-ink">
                Terms of Service
              </Link>
              .
            </p>
          </div>

          <p className="text-center text-[12.5px] text-ink/40">
            Free plan · No credit card · Official WhatsApp Cloud API
          </p>
        </section>
      </div>
    </main>
  );
}

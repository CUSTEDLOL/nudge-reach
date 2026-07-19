"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, X } from "lucide-react";

/**
 * "Get Access" CTA + popup form (Name / Email / Phone). Submits to the public
 * /api/access endpoint, which stores the lead and forwards it to the founders'
 * inbox. The trigger renders whatever children/className it's given so it can
 * match any surface (hero, navbar, …).
 */
export function GetAccessButton({
  className,
  children,
  source = "hero",
}: {
  className?: string;
  children: React.ReactNode;
  source?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && <GetAccessModal source={source} onClose={() => setOpen(false)} />}
    </>
  );
}

const inputClass =
  "w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition-all placeholder:text-ink/35 focus:border-ink focus:shadow-[3px_3px_0_rgba(10,15,13,0.15)]";

function GetAccessModal({
  source,
  onClose,
}: {
  source: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Portal to <body>: the hero applies GSAP transforms to the trigger's
  // ancestors, and position:fixed resolves against a transformed ancestor —
  // rendered in place, the overlay ends up clipped inside the hero.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const form = e.currentTarget;
    const payload = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
      source,
    };

    try {
      const res = await fetch("/api/access", {
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

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-ink/50 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Get access"
    >
      <div
        className="relative w-full max-w-md rounded-[1.75rem] border-2 border-ink/70 bg-white p-6 shadow-[9px_9px_0_rgba(10,15,13,0.82)] sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border-2 border-ink/15 text-ink/50 transition-colors hover:border-ink hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        {status === "done" ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-ink/70 bg-brand-100 text-brand-700">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h3 className="mt-4 font-display text-xl font-black text-ink">
              Request received
            </h3>
            <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink/60">
              We onboard businesses one by one. We&apos;ll reach out on WhatsApp
              to get you set up.
            </p>
          </div>
        ) : (
          <>
            <h3 className="font-display text-xl font-black text-ink">Get access</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink/60">
              Leave your details and we&apos;ll set up your AI Front Desk with you.
            </p>
            <form className="mt-5 flex flex-col gap-3.5" onSubmit={onSubmit}>
              <Field label="Name">
                <input name="name" required placeholder="e.g. Priya Sharma" className={inputClass} />
              </Field>
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@business.com"
                  className={inputClass}
                />
              </Field>
              <Field label="WhatsApp number">
                <input
                  name="phone"
                  type="tel"
                  required
                  placeholder="+91 98xxxxxxxx"
                  className={inputClass}
                />
              </Field>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="mt-1 inline-flex h-[3.35rem] items-center justify-center gap-2 rounded-full bg-brand-500 text-base font-semibold text-white shadow-[0_4px_0_#047f48] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-400 hover:shadow-[0_6px_0_#047f48] active:translate-y-0 active:shadow-[0_2px_0_#047f48] disabled:pointer-events-none disabled:opacity-70"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Sending…
                  </>
                ) : (
                  "Get access"
                )}
              </button>
              {error ? (
                <p className="text-center text-[13px] font-medium text-red-600">{error}</p>
              ) : (
                <p className="text-center text-[12.5px] text-ink/45">
                  No spam, no credit card. We&apos;ll WhatsApp you to set things up.
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
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

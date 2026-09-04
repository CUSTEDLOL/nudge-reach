"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";
import { LaunchDemoButton } from "./launch-cta";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Compare", href: "/#compare" },
  { label: "Live Demo", href: "/demo" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
];

function NavLinks({ overHero }: { overHero: boolean }) {
  return (
    <ul className="flex items-center gap-0.5">
      {NAV_LINKS.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            className={cn(
              "block rounded-lg px-3.5 py-2.5 text-[16px] font-bold transition-all duration-200 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
              overHero
                ? "text-white/85 hover:bg-white/10 hover:text-white"
                : "text-ink/65 hover:bg-ink/[0.06] hover:text-ink"
            )}
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The solid CTA — flat ink pill with a brand-glow lift on hover. The arrow
 * slides and the whole button lifts. Opens the Cal modal. */
function NavCta({ overHero }: { overHero: boolean }) {
  return (
    <LaunchDemoButton
      tone={overHero ? "dark" : "light"}
      className="group/cta hidden min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(6,193,103,0.55)] active:translate-y-0 active:scale-[0.98] lg:inline-flex"
    >
      <span>Book a Demo</span>
      <ArrowRight
        className="h-4 w-4 -mr-0.5 transition-transform duration-300 group-hover/cta:translate-x-1"
        aria-hidden
      />
    </LaunchDemoButton>
  );
}

/** The staircase that ends the white slab — six blocky bands, irregular
 * depths, all right angles. Steps stay small (~3-10% of the slab) so each
 * one reads as a square block rather than a long stripe. Percentages of
 * the slab's own box. */
const PIXEL_EDGE = [92, 86, 95, 84, 90, 83];

const EDGE_POLYGON = (() => {
  const band = 100 / PIXEL_EDGE.length;
  const pts: string[] = ["0% 0%"];
  PIXEL_EDGE.forEach((x, i) => {
    pts.push(`${x}% ${i * band}%`, `${x}% ${(i + 1) * band}%`);
  });
  pts.push("0% 100%");
  return `polygon(${pts.join(", ")})`;
})();

/** Loose blocks trailing off the staircase, fading as they scatter — the
 * "pixels coming apart" beat. x/y are % of the slab box; size is px so the
 * blocks stay chunky and square at every width. */
const PIXEL_DUST = [
  { x: 97, y: 4, o: 0.8 },
  { x: 106, y: 4, o: 0.32 },
  { x: 101, y: 21, o: 0.55 },
  { x: 99, y: 38, o: 0.7 },
  { x: 109, y: 38, o: 0.26 },
  { x: 104, y: 55, o: 0.42 },
  { x: 98, y: 72, o: 0.6 },
  { x: 112, y: 72, o: 0.18 },
  { x: 105, y: 88, o: 0.3 },
];
const DUST_PX = 8;

/** A slab under the logo, dissolving to the right in blocky Minecraft-style
 * steps. Over the hero it's white so the green wordmark reads on white;
 * once the navbar leaves the hero it recolors to ink to match the solid
 * pill instead of just vanishing. Sized by the logo wrapper it lives in
 * (not the pill) so it can never run under the nav links: it bleeds out to
 * the pill's left/top/bottom edges (negative insets mirror the pill's
 * padding) and trails 2.5rem past the wordmark for the staircase + dust.
 * The pill's own overflow clips the rounded corners. */
function PixelSlab({ overHero }: { overHero: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-y-2.5 -left-4 -right-10 z-0 sm:-left-5 lg:-left-6"
    >
      <div
        className={cn(
          "absolute inset-0 transition-colors duration-500 ease-out",
          overHero ? "bg-white/95" : "bg-ink/90"
        )}
        style={{ clipPath: EDGE_POLYGON }}
      />
      {PIXEL_DUST.map((b, i) => (
        <span
          key={i}
          className={cn(
            "absolute transition-colors duration-500 ease-out",
            overHero ? "bg-white" : "bg-ink/90"
          )}
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: DUST_PX,
            height: DUST_PX,
            opacity: b.o,
          }}
        />
      ))}
    </div>
  );
}

/**
 * One centered navbar pill that stays the same across the whole page.
 */
export function Navbar() {
  const [open, setOpen] = useState(false);
  const [overHero, setOverHero] = useState(true);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const hero = document.getElementById("night-shift");
      setOverHero(hero ? hero.getBoundingClientRect().top > 80 : false);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const onResize = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-[110rem] justify-center">
        <div
          className={cn(
            "relative flex w-full max-w-5xl items-center justify-between gap-3 overflow-hidden rounded-2xl px-4 py-2.5 sm:px-5 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:px-6",
            overHero
              ? "border border-white/25 bg-white/[0.16] text-white shadow-[0_8px_32px_-12px_rgba(3,10,7,0.35)] backdrop-blur-xl"
              : "border border-black/[0.06] bg-white/92 text-ink shadow-[0_14px_44px_-16px_rgba(10,31,26,0.22)] backdrop-blur-xl"
          )}
        >
          {/* left — logo on its dissolving slab, always visible */}
          <div className="relative z-10 flex items-center self-stretch lg:justify-self-start">
            <PixelSlab overHero={overHero} />
            <Logo tone="light" id="nav-logo-target" className="relative z-10" />
          </div>

          {/* center — nav links, true-centered in the pill (desktop only) */}
          <div className="relative z-10 hidden lg:flex lg:justify-self-center">
            <NavLinks overHero={overHero} />
          </div>

          {/* right — Sign in + the solid CTA (desktop only) */}
          <div className="relative z-10 hidden items-center gap-2 lg:flex lg:justify-self-end">
            <a
              href="/login"
              className={cn(
                "hidden min-h-11 items-center whitespace-nowrap rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors lg:inline-flex",
                overHero ? "text-white/85 hover:text-white" : "text-ink/65 hover:text-ink"
              )}
            >
              Sign in
            </a>
            <NavCta overHero={overHero} />
          </div>

          {/* mobile hamburger */}
          <div className="relative z-10 flex items-center gap-2 lg:hidden">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
                overHero ? "text-white hover:bg-white/10" : "text-ink hover:bg-ink/[0.06]"
              )}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 top-0 z-40 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
          >
            <div
              className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+6rem)] max-h-[calc(100dvh-env(safe-area-inset-top)-7rem)] overflow-y-auto overscroll-contain rounded-2xl border border-black/[0.06] bg-white/95 p-3 shadow-[0_30px_80px_-20px_rgba(10,31,26,0.35)] backdrop-blur-xl"
            >
              <ul className="flex flex-col">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 items-center rounded-xl px-4 py-3 text-base font-medium text-ink/75 transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-col gap-2 border-t border-black/[0.06] p-2 pt-3">
                <a
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center justify-center rounded-xl px-4 py-3 text-base font-medium text-ink/75 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                >
                  Sign in
                </a>
                <LaunchDemoButton variant="primary" className="w-full">
                  Book a Demo
                </LaunchDemoButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";
import { ButtonLink } from "./button";
import { BookDemoButton } from "./book-demo";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Compare", href: "/#compare" },
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
              "block rounded-lg px-3.5 py-2 text-[16px] font-bold transition-all duration-200 hover:-translate-y-px",
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

/** The solid CTA — ink pill with a glossy sweep + brand-glow lift on hover.
 * The arrow slides, the shine sweeps across, the whole button lifts. Opens
 * the Cal modal. */
function NavCta() {
  return (
    <BookDemoButton
      className="group/cta relative hidden items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-inset ring-white/[0.06] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_28px_-8px_rgba(6,193,103,0.55)] active:translate-y-0 active:scale-[0.98] md:inline-flex"
    >
      {/* glossy sweep */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover/cta:translate-x-[320%]"
      />
      <span className="relative">Book a Demo</span>
      <ArrowRight
        className="relative h-4 w-4 -mr-0.5 transition-transform duration-300 group-hover/cta:translate-x-1"
        aria-hidden
      />
    </BookDemoButton>
  );
}

/** The quiet second action — routes to /login (handles both sign-up and
 * sign-in already). Text-only so "Book a Demo" stays the one solid pill. */
function SignUpLink({ overHero }: { overHero: boolean }) {
  return (
    <Link
      href="/login"
      className={cn(
        "hidden whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[14px] font-semibold transition-all duration-200 md:inline-flex",
        overHero
          ? "text-white/90 hover:bg-white/10 hover:text-white"
          : "text-ink/70 hover:bg-ink/[0.06] hover:text-ink"
      )}
    >
      Sign Up
    </Link>
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

/** A white slab under the logo, dissolving to the right in blocky
 * Minecraft-style steps, so the green wordmark reads on white over the
 * hero. On the hand-off out of the hero the slab SWEEPS right across the
 * whole pill — its pixel edge leading like a grid clearing the track —
 * and slides off, revealing the solid pill behind it. A fixed-width slab
 * that translates, so the pixel staircase stays crisp the whole way and
 * the pill's overflow clips it. */
function PixelSlab({ racing }: { racing: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 left-0 z-0 w-[46%] transition-transform duration-[640ms] ease-[cubic-bezier(0.72,0,0.24,1)] sm:w-[34%] md:w-[24%]",
        racing ? "translate-x-[460%]" : "translate-x-0"
      )}
    >
      <div
        className="absolute inset-0 bg-white/95"
        style={{ clipPath: EDGE_POLYGON }}
      />
      {PIXEL_DUST.map((b, i) => (
        <span
          key={i}
          className="absolute bg-white"
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
  /** The pill's own fill lags the hand-off so the racing slab lands first
   * and the solid state "kicks in" behind it, rather than cross-fading. */
  const [solidBg, setSolidBg] = useState(false);

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

  // Leaving the hero: hold the glass while the slab races across, then drop
  // the solid fill in under it. Returning: switch back immediately so the
  // slab retracts over glass, not over white.
  useEffect(() => {
    // Both directions go through a timer so the state change never happens
    // synchronously in the effect body. Leaving the hero: flip the pill to
    // solid (text glass→ink, bg → white) mid-sweep, so the black "kicks in"
    // exactly as the pixel band passes over it. Returning: flip back at once.
    const t = window.setTimeout(() => setSolidBg(!overHero), overHero ? 0 : 320);
    return () => window.clearTimeout(t);
  }, [overHero]);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-5">
      <div className="mx-auto flex w-full max-w-[110rem] justify-center">
        <div
          className={cn(
            "relative flex w-full max-w-5xl items-center justify-between gap-3 overflow-hidden rounded-2xl px-4 py-2.5 transition-colors duration-300 sm:px-5 md:grid md:grid-cols-[1fr_auto_1fr] md:px-6",
            solidBg
              ? "border border-black/[0.06] bg-white/92 text-ink shadow-[0_14px_44px_-16px_rgba(10,31,26,0.22)] backdrop-blur-xl"
              : "border border-white/25 bg-white/[0.16] text-white shadow-[0_8px_32px_-12px_rgba(3,10,7,0.35)] backdrop-blur-xl"
          )}
        >
          <PixelSlab racing={!overHero} />

          {/* left — logo, always visible */}
          <div className="relative z-10 flex items-center md:justify-self-start">
            <Logo tone="light" id="nav-logo-target" />
          </div>

          {/* center — nav links, true-centered in the pill (desktop only) */}
          <div className="relative z-10 hidden md:flex md:justify-self-center">
            <NavLinks overHero={overHero} />
          </div>

          {/* right — sign up + the one solid CTA (desktop only) */}
          <div className="relative z-10 hidden items-center gap-1 md:flex md:justify-self-end">
            <SignUpLink overHero={overHero} />
            <NavCta />
          </div>

          {/* mobile hamburger */}
          <div className="relative z-10 flex items-center gap-2 md:hidden">
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors",
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
            className="fixed inset-0 top-0 z-40 md:hidden"
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
              className="absolute inset-x-4 top-24 rounded-2xl border border-black/[0.06] bg-white/95 p-3 shadow-[0_30px_80px_-20px_rgba(10,31,26,0.35)] backdrop-blur-xl"
            >
              <ul className="flex flex-col">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-4 py-3 text-base font-medium text-ink/75 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-col gap-2 border-t border-black/[0.06] p-2 pt-3">
                <BookDemoButton variant="primary" className="w-full">
                  Book a Demo
                </BookDemoButton>
                <ButtonLink
                  href="/login"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setOpen(false)}
                >
                  Sign Up
                </ButtonLink>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

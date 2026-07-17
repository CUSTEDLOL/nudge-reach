"use client";

import { AnimatePresence, motion } from "motion/react";
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

const MERGE = { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const };

// One light glass skin, everywhere — no dark/green mode.
const glass =
  "border border-black/[0.06] bg-white/90 backdrop-blur-xl shadow-[0_14px_44px_-16px_rgba(10,31,26,0.22)]";

function NavLinks() {
  return (
    <ul className="flex items-center gap-0.5">
      {NAV_LINKS.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            className="block rounded-lg px-3 py-2 text-[14px] font-medium text-ink/65 transition-all duration-200 hover:-translate-y-px hover:bg-ink/[0.06] hover:text-ink"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Sleek solid CTA — ink, always. The arrow slides on hover. Opens the Cal modal. */
function NavCta() {
  return (
    <BookDemoButton className="group/cta hidden items-center gap-1.5 whitespace-nowrap rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[#1b241f] md:inline-flex">
      Book a Demo
      <ArrowRight
        className="h-4 w-4 -mr-0.5 transition-transform duration-300 group-hover/cta:translate-x-1"
        aria-hidden
      />
    </BookDemoButton>
  );
}

/**
 * Two-mode navbar, one light glass skin. Over the dark hero it's two
 * separate boxes (logo, then links+CTA) at opposite ends of the bar; past
 * the hero they physically slide together into one seamless pill — a quick
 * layout-driven merge, not a crossfade. `layout` on both boxes + the outer
 * row lets Framer compute the FLIP; the inner corners square off and flatten
 * via a plain CSS radius/border transition timed to match.
 */
export function Navbar() {
  const [separated, setSeparated] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Separated while the dark hero is still behind the bar; merged once its
    // top passes (the night-shift section — and everything after — is light).
    const onScroll = () => {
      const hero = document.getElementById("night-shift");
      setSeparated(hero ? hero.getBoundingClientRect().top > 80 : false);
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
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:px-6 sm:pt-5">
      <motion.div
        layout
        transition={MERGE}
        className={cn(
          "flex w-full items-center justify-between gap-3",
          !separated && "md:w-fit md:justify-start md:gap-0"
        )}
      >
        {/* Logo box — squares off its right edge and drops the border once merged */}
        <motion.div
          layout
          transition={MERGE}
          className={cn(
            glass,
            "flex items-center px-4 py-2 transition-[border-radius] duration-300",
            !separated && "md:rounded-r-none md:border-r-0"
          )}
        >
          <Logo tone="light" />
        </motion.div>

        {/* Right box — mobile: hamburger only. Desktop: links + divider + CTA.
            Squares off its left edge and drops the border once merged. */}
        <motion.div
          layout
          transition={MERGE}
          className={cn(
            glass,
            "flex items-center p-1.5 transition-[border-radius] duration-300",
            !separated && "md:rounded-l-none md:border-l-0"
          )}
        >
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink transition-colors hover:bg-ink/[0.06] md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="hidden items-center gap-2 md:flex">
            <NavLinks />
            <span className="mx-1 h-6 w-px bg-ink/10" aria-hidden />
            <NavCta />
          </div>
        </motion.div>
      </motion.div>

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
                  Sign in
                </ButtonLink>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

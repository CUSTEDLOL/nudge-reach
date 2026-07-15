"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { ChevronRight, Clock3, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";
import { ButtonLink } from "./button";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Compare", href: "/#compare" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
];

/** Live IST clock — the quiet proof that the Front Desk is on shift now. */
function ISTClock() {
  const [now, setNow] = useState("");

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
    const tick = () => setNow(fmt.format(new Date()).toUpperCase());
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0b3d2e]/60 px-3.5 py-2 text-[12.5px] font-semibold tracking-wide text-white/80 backdrop-blur-xl">
      <Clock3 className="h-3.5 w-3.5 text-white/55" aria-hidden />
      <span
        className="min-w-[4.1rem] text-center tabular-nums"
        suppressHydrationWarning
      >
        {now}
      </span>
      <span className="text-white/40">IST</span>
    </div>
  );
}

/** One floating glass pill, centered: mark, links, flagship CTA. The live
 * clock rides the far top-right on wide screens. */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:pt-5">
      <div className="relative mx-auto flex max-w-[110rem] items-center justify-center">
        <motion.nav
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-2xl border border-white/10 p-2 shadow-[0_16px_50px_-12px_rgba(2,18,11,0.6)] backdrop-blur-xl transition-colors duration-300 sm:max-w-md md:w-auto md:max-w-none md:justify-center md:gap-1",
            scrolled ? "bg-[#07261c]/85" : "bg-[#0b3d2e]/60"
          )}
        >
          <Logo compact tone="dark" className="pl-1 md:pl-0.5" />

          <ul className="hidden items-center md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-xl px-3.5 py-2 text-[14px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <Link
            href="/waitlist"
            className="group/cta ml-1 hidden items-center gap-2.5 whitespace-nowrap rounded-xl bg-brand-500 py-2 pl-4 pr-2 text-[13.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-brand-600 md:inline-flex"
          >
            Hire the Front Desk
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/12 transition-transform duration-300 group-hover/cta:translate-x-0.5">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </Link>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-xl text-white transition-colors hover:bg-white/10 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </motion.nav>

        <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 xl:block">
          <ISTClock />
        </div>
      </div>

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
              className="absolute inset-0 bg-[#03150e]/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-4 top-20 rounded-3xl border border-white/10 bg-[#07261c]/95 p-3 shadow-[0_30px_80px_-20px_rgba(2,12,8,0.85)] backdrop-blur-xl"
            >
              <ul className="flex flex-col">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-2xl px-4 py-3 text-base font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-col gap-2 border-t border-white/10 p-2 pt-3">
                <ButtonLink
                  href="/waitlist"
                  variant="primary-dark"
                  className="w-full"
                  onClick={() => setOpen(false)}
                >
                  Hire the Front Desk
                </ButtonLink>
                <ButtonLink
                  href="/login"
                  variant="secondary-dark"
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

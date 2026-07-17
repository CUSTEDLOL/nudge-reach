"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { ChevronRight, Menu, X } from "lucide-react";
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

/** Reference layout: wordmark far left in its own glass pill; on the right a
 * segmented cluster — links pill, then the flagship CTA as a solid white
 * button on the far edge. */
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

  const glass = cn(
    "rounded-2xl border border-white/10 shadow-[0_16px_50px_-12px_rgba(2,18,11,0.6)] backdrop-blur-xl transition-colors duration-300",
    scrolled ? "bg-[#07261c]/85" : "bg-[#0b3d2e]/60"
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-5">
      <motion.div
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex max-w-[110rem] items-center justify-between gap-3"
      >
        {/* brand — far left, its own pill */}
        <div className={cn(glass, "flex items-center px-3.5 py-1.5")}>
          <Logo tone="dark" />
        </div>

        {/* right cluster — segmented pills, then the white CTA on the edge */}
        <div className="flex items-center gap-2">
          <nav className={cn(glass, "hidden p-1.5 md:block")}>
            <ul className="flex items-center">
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
              <li>
                <BookDemoButton className="whitespace-nowrap rounded-xl px-3.5 py-2 text-[14px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                  Book a Demo
                </BookDemoButton>
              </li>
            </ul>
          </nav>

          <Link
            href="/waitlist"
            className="group/cta hidden items-center gap-2.5 whitespace-nowrap rounded-2xl bg-white py-2.5 pl-5 pr-2.5 text-[14px] font-semibold text-ink shadow-[0_16px_50px_-12px_rgba(2,18,11,0.45)] transition-colors hover:bg-white/90 md:inline-flex"
          >
            Hire the Front Desk
            <span className="grid h-6 w-6 place-items-center rounded-full bg-ink/10 transition-transform duration-300 group-hover/cta:translate-x-0.5">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </Link>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              glass,
              "grid h-11 w-11 place-items-center text-white md:hidden"
            )}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.div>

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
                <BookDemoButton variant="secondary-dark" className="w-full">
                  Book a Demo
                </BookDemoButton>
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

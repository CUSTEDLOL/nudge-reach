"use client";

import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";
import { ButtonLink } from "./button";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Salary math", href: "/#salary" },
  { label: "Compare", href: "/#compare" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
];

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
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 sm:pt-4">
      <motion.nav
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "flex w-full max-w-6xl items-center justify-between gap-4 rounded-full px-3 py-2.5 pl-5 transition-all duration-500",
          scrolled
            ? "glass border border-black/5 shadow-soft"
            : "border border-transparent"
        )}
      >
        <Logo />

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-3.5 py-2 text-[14.5px] font-medium text-ink/70 transition-colors hover:bg-black/5 hover:text-ink night:text-white/70 night:hover:bg-white/10 night:hover:text-white"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <span className="hidden lg:block">
            <ButtonLink
              href="/waitlist"
              variant="ghost"
              size="sm"
              className="whitespace-nowrap"
            >
              Book a demo
            </ButtonLink>
          </span>
          <ButtonLink
            href="/login"
            variant="primary"
            size="sm"
            className="whitespace-nowrap"
          >
            Start free
          </ButtonLink>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-black/5 night:text-white night:hover:bg-white/10 md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </motion.nav>

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
              className="absolute inset-x-4 top-20 rounded-3xl border border-black/5 bg-white p-3 shadow-lift"
            >
              <ul className="flex flex-col">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-2xl px-4 py-3 text-base font-medium text-ink/80 transition-colors hover:bg-brand-50 hover:text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-col gap-2 border-t border-black/5 p-2 pt-3">
                <ButtonLink
                  href="/waitlist"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setOpen(false)}
                >
                  Book a demo
                </ButtonLink>
                <ButtonLink
                  href="/login"
                  variant="primary"
                  className="w-full"
                  onClick={() => setOpen(false)}
                >
                  Start free
                </ButtonLink>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

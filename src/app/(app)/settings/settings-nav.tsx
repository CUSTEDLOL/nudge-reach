"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  activeSettingsHref,
  SETTINGS_GROUPS,
} from "@/app/(app)/settings/settings-items";

export function SettingsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const currentHref = activeSettingsHref(pathname);

  return (
    <nav aria-label="Settings sections" className="min-w-0 shrink-0 lg:w-52">
      <div className="lg:hidden">
        <label
          htmlFor="settings-section"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Settings section
        </label>
        <div className="relative">
          <select
            id="settings-section"
            value={currentHref}
            onChange={(event) => router.push(event.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-neutral-200 bg-white px-3 pr-10 text-base font-medium text-neutral-900 outline-none transition-colors focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/30"
          >
            {SETTINGS_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <option key={item.href} value={item.href}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
        </div>
      </div>

      <div className="hidden space-y-6 lg:block">
        {SETTINGS_GROUPS.map((group) => (
          <section key={group.label} aria-labelledby={`settings-${group.label}`}>
            <h2
              id={`settings-${group.label}`}
              className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400"
            >
              {group.label}
            </h2>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = currentHref === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-500",
                        active
                          ? "bg-brand-50 font-semibold text-brand-800"
                          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-2.5 h-6 w-[3px] rounded-r-full bg-brand-600"
                        />
                      )}
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-brand-700" : "text-neutral-400"
                        )}
                        aria-hidden
                      />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}

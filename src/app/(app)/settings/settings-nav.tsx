"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BellRing,
  Building2,
  CreditCard,
  Database,
  Blocks,
  Phone,
  PhoneCall,
  ScrollText,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";

// The AI Agent (setup + training) is top-level in the main sidebar (/agent) —
// it no longer lives under Settings.
const items = [
  { href: "/settings/general", label: "General", icon: Building2 },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/automations", label: "Follow-ups", icon: BellRing },
  { href: "/integrations", label: "Integrations", icon: Blocks },
  { href: "/settings/concierge", label: "Concierge", icon: Wand2 },
  { href: "/settings/whatsapp", label: "WhatsApp", icon: Phone },
  { href: "/settings/voice", label: "Voice", icon: PhoneCall },
  { href: "/settings/custom-actions", label: "Agent actions", icon: Zap },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/data", label: "Data", icon: Database },
  { href: "/settings/audit", label: "Audit log", icon: ScrollText },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="min-w-0 shrink-0 lg:w-52">
      {/* Below lg: one horizontally-scrollable chip row (bleeds to the screen
          edge); at lg+: the classic vertical list. */}
      <ul className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0 lg:shrink">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-400/50 lg:rounded-lg lg:border-0 lg:px-3",
                  active
                    ? "border-brand-200 bg-brand-50 font-medium text-brand-700"
                    : "border-neutral-200 text-neutral-600 hover:bg-black/5 hover:text-neutral-900 lg:border-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-brand-600" : "text-neutral-400"
                  )}
                  aria-hidden
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

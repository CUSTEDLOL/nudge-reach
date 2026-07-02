"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  Building2,
  CreditCard,
  Database,
  Phone,
  ScrollText,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/settings/general", label: "General", icon: Building2 },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/agent", label: "AI Agent", icon: Bot },
  { href: "/settings/whatsapp", label: "WhatsApp", icon: Phone },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/data", label: "Data", icon: Database },
  { href: "/settings/audit", label: "Audit log", icon: ScrollText },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="shrink-0 lg:w-52">
      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-400/50",
                  active
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "text-neutral-600 hover:bg-black/5 hover:text-neutral-900"
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

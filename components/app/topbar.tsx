"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/dropdown";
import type { SidebarUser } from "@/components/app/sidebar";

export function Topbar({
  orgName,
  user,
}: {
  orgName: string;
  user: SidebarUser;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/contacts?q=${encodeURIComponent(q)}` : "/contacts");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-black/5 bg-white px-4 sm:px-6">
      {/* Mobile brand mark — the sidebar (and its logo) only exists at lg+. */}
      <Link
        href="/dashboard"
        aria-label="Nudge dashboard"
        className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-white" fill="none" aria-hidden>
          <path
            d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9.5L6 21v-3H5A1.5 1.5 0 0 1 3.5 16.5V7A1.5 1.5 0 0 1 5 5.5Z"
            fill="currentColor"
            opacity="0.95"
          />
          <circle cx="9" cy="11.5" r="1.1" fill="#0b3d2e" />
          <circle cx="12.5" cy="11.5" r="1.1" fill="#0b3d2e" />
          <circle cx="16" cy="11.5" r="1.1" fill="#0b3d2e" />
        </svg>
      </Link>

      <form
        onSubmit={onSearchSubmit}
        role="search"
        className="relative w-full max-w-md"
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts…"
          aria-label="Search contacts"
          className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 outline-none transition-colors duration-150 placeholder:text-neutral-400 focus-visible:border-brand-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-brand-400/50"
        />
      </form>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden truncate text-sm font-medium text-neutral-700 sm:block">
          {orgName}
        </span>
        <Menu
          align="end"
          triggerLabel="Account menu"
          triggerClassName="p-0.5"
          trigger={
            <>
              <Avatar name={user.name} size="md" />
              <ChevronDown className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
            </>
          }
        >
          <MenuLabel>
            <span className="block truncate font-medium text-neutral-700">
              {user.name}
            </span>
            <span className="block truncate">{user.email}</span>
          </MenuLabel>
          <MenuSeparator />
          <MenuItem href="/settings">Settings</MenuItem>
          <MenuSeparator />
          <form action="/auth/signout" method="post">
            <MenuItem
              type="submit"
              danger
              icon={<LogOut className="h-4 w-4" aria-hidden />}
            >
              Sign out
            </MenuItem>
          </form>
        </Menu>
      </div>
    </header>
  );
}

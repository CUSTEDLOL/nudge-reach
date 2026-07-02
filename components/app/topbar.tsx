"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu as MenuIcon, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/dropdown";
import type { SidebarUser } from "@/components/app/sidebar";

export function Topbar({
  orgName,
  user,
  onMenuToggle,
}: {
  orgName: string;
  user: SidebarUser;
  /** Opens the mobile sidebar drawer. */
  onMenuToggle?: () => void;
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
      <button
        type="button"
        onClick={onMenuToggle}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-neutral-500 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-brand-400/50 lg:hidden"
      >
        <MenuIcon className="h-5 w-5" aria-hidden />
      </button>

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

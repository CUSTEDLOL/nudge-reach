"use client";

import {
  ChevronDown,
  CircleHelp,
  FlaskConical,
  LogOut,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/dropdown";
import { BrandMark } from "@/components/features/app-shell/brand-mark";
import { CommandMenu } from "@/components/features/app-shell/command-menu";
import type { SidebarUser } from "@/components/features/app-shell/sidebar";
import type { AppRole } from "@/components/features/app-shell/nav";

export function Topbar({
  orgName,
  user,
  role,
  simulation = false,
}: {
  orgName: string;
  user: SidebarUser;
  role: AppRole;
  simulation?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white px-4 sm:px-6">
      <BrandMark compact className="lg:hidden" />
      <CommandMenu role={role} />

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <span className="hidden max-w-48 truncate text-sm font-medium text-neutral-800 md:block">
          {orgName}
        </span>
        {simulation && (
          <span
            title="Test mode — nothing reaches real customers"
            className="hidden items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 sm:flex"
          >
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            Test mode
          </span>
        )}
        <a
          href="mailto:support@nudgeagent.app"
          aria-label="Help & support"
          title="Help & support"
          className="grid h-9 w-9 place-items-center rounded-md text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <CircleHelp className="h-[18px] w-[18px]" aria-hidden />
        </a>
        <Menu
          align="end"
          triggerLabel="Account menu"
          triggerClassName="p-0.5"
          trigger={
            <>
              <Avatar name={user.name} size="md" />
              <ChevronDown className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
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
          <MenuItem href="/settings" icon={<Settings className="h-4 w-4" aria-hidden />}>
            Settings
          </MenuItem>
          {role !== "AGENT" && (
            <MenuItem
              href="/onboarding?customize=1"
              icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
            >
              Customize workspace
            </MenuItem>
          )}
          <MenuItem
            href="mailto:support@nudgeagent.app"
            icon={<CircleHelp className="h-4 w-4" aria-hidden />}
          >
            Help & support
          </MenuItem>
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

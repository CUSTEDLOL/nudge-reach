"use client";

import { ChevronDown, LogOut } from "lucide-react";
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
}: {
  orgName: string;
  user: SidebarUser;
  role: AppRole;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <BrandMark compact className="lg:hidden" />
      <CommandMenu role={role} />

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden max-w-48 truncate text-sm font-medium text-neutral-700 md:block">
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

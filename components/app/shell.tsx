"use client";

import { useState, type ReactNode } from "react";
import { Sidebar, type SidebarUser } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import type { AppRole } from "@/components/app/nav";

/**
 * Client wrapper coordinating the mobile sidebar state between the topbar
 * hamburger and the sidebar drawer. Rendered by app/(app)/layout.tsx.
 */
export function AppShell({
  orgName,
  user,
  role = "OWNER",
  simulation = false,
  children,
}: {
  orgName: string;
  user: SidebarUser;
  role?: AppRole;
  simulation?: boolean;
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar
        role={role}
        simulation={simulation}
        user={user}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar
          orgName={orgName}
          user={user}
          onMenuToggle={() => setMobileNavOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

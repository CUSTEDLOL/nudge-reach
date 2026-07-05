"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Sidebar, type SidebarUser } from "@/components/features/app-shell/sidebar";
import { Topbar } from "@/components/features/app-shell/topbar";
import { BottomNav, isThreadRoute } from "@/components/features/app-shell/bottom-nav";
import type { AppRole } from "@/components/features/app-shell/nav";

/**
 * App chrome: dark sidebar on desktop (lg+), fixed bottom navigation on
 * mobile. The inbox thread route hides the bottom bar so the chat composer
 * owns the bottom edge. Rendered by app/(app)/layout.tsx.
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
  const pathname = usePathname();
  // Reserve space for the bottom bar wherever it is shown (< lg, non-thread).
  const hasBottomNav = !isThreadRoute(pathname);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar role={role} simulation={simulation} user={user} />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar orgName={orgName} user={user} />
        <main
          className={cn(
            "mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8",
            hasBottomNav &&
              "pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6"
          )}
        >
          {children}
        </main>
      </div>
      <BottomNav role={role} user={user} simulation={simulation} />
    </div>
  );
}

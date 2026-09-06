"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  initialSidebarCollapsed = false,
  children,
}: {
  orgName: string;
  user: SidebarUser;
  role?: AppRole;
  simulation?: boolean;
  initialSidebarCollapsed?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    initialSidebarCollapsed
  );
  const previousPathname = useRef(pathname);
  // Reserve space for the bottom bar wherever it is shown (< lg, non-thread).
  const hasBottomNav = !isThreadRoute(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);

  function updateSidebar(collapsed: boolean) {
    setSidebarCollapsed(collapsed);
  }

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#f7f8f7]">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[120] -translate-y-20 rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white outline-none transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <Sidebar
        role={role}
        simulation={simulation}
        orgName={orgName}
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={updateSidebar}
      />
      <div
        className={cn(
          "flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200 motion-reduce:transition-none",
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[232px]"
        )}
      >
        <Topbar orgName={orgName} user={user} role={role} />
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8",
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

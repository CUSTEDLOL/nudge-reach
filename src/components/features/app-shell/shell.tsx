"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { FlaskConical, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { BrandMark } from "@/components/features/app-shell/brand-mark";
import { Sidebar, type SidebarUser } from "@/components/features/app-shell/sidebar";
import { Topbar } from "@/components/features/app-shell/topbar";
import { BottomNav, isThreadRoute } from "@/components/features/app-shell/bottom-nav";
import type { AppRole } from "@/components/features/app-shell/nav";
import { saveSidebarCollapsedAction } from "@/app/(app)/shell-actions";

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
    startTransition(() => {
      void saveSidebarCollapsedAction(collapsed);
    });
  }

  if (pathname === "/onboarding") {
    return (
      <div className="min-h-dvh overflow-x-clip bg-[#f7f8f7]">
        <SkipLink />
        <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
          <BrandMark />
          <div className="flex items-center gap-2 sm:gap-3">
            {simulation && (
              <span className="hidden items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 sm:flex">
                <FlaskConical className="h-3.5 w-3.5" aria-hidden />
                Safe test workspace
              </span>
            )}
            <Avatar name={user.name} size="sm" />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="grid h-11 w-11 place-items-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl px-4 py-4 outline-none sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#f7f8f7]">
      <SkipLink />
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

function SkipLink() {
  return (
    <a
      href="#main-content"
      className="fixed left-3 top-3 z-[120] -translate-y-20 rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white outline-none transition-transform focus:translate-y-0"
    >
      Skip to content
    </a>
  );
}

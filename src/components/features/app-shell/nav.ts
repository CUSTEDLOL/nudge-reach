import {
  Inbox,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Mirrors the upcoming Prisma `OrgRole` enum — kept local so the shell
 *  doesn't depend on the schema landing first. */
export type AppRole = "OWNER" | "ADMIN" | "AGENT";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden in the sidebar for AGENT role (server-checked by modules too). */
  hideForAgent?: boolean;
};

/** Single source of truth for the app sidebar. Deliberately short: the
 *  flagship owner needs five things, not a cockpit. The power tools
 *  (Train your AI, Integrations, Auto-replies, Templates) live under
 *  Settings/Campaigns; Analytics is folded into the Dashboard. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Chats", href: "/inbox", icon: Inbox },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Settings", href: "/settings", icon: Settings, hideForAgent: true },
];

export function navItemsForRole(role: AppRole): NavItem[] {
  return role === "AGENT"
    ? NAV_ITEMS.filter((item) => !item.hideForAgent)
    : NAV_ITEMS;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

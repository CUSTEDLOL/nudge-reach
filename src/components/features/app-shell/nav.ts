import {
  BarChart3,
  Blocks,
  BookOpen,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Megaphone,
  Settings,
  Users,
  Workflow,
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

/** Single source of truth for the app sidebar (exact order per spec §3.6). */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Templates", href: "/templates", icon: LayoutTemplate, hideForAgent: true },
  { label: "Automations", href: "/automations", icon: Workflow, hideForAgent: true },
  { label: "Knowledge", href: "/knowledge", icon: BookOpen },
  { label: "Analytics", href: "/analytics", icon: BarChart3, hideForAgent: true },
  { label: "Integrations", href: "/integrations", icon: Blocks, hideForAgent: true },
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

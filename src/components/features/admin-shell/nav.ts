import {
  Activity,
  Building2,
  HeartPulse,
  LayoutDashboard,
  ScrollText,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Show the "new leads" count next to this item. */
  badge?: "leads";
};

export type AdminNavGroup = { label: string; items: AdminNavItem[] };

/** Founder panel navigation. Order = how often a founder reaches for it. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Platform",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/orgs", label: "Organisations", icon: Building2 },
      { href: "/admin/leads", label: "Leads", icon: UserPlus, badge: "leads" },
      { href: "/admin/revenue", label: "Revenue", icon: Wallet },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/admin/events", label: "Events", icon: Activity }],
  },
  {
    label: "System",
    items: [
      { href: "/admin/ops", label: "Ops health", icon: HeartPulse },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

/** Exact match for the root, prefix match for everything else. */
export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Per-org sub-navigation (orgs/[id]/layout). */
export const ORG_TABS = [
  { slug: "", label: "Overview" },
  { slug: "team", label: "Team" },
  { slug: "integrations", label: "Integrations" },
  { slug: "agent", label: "Front Desk" },
  { slug: "usage", label: "Usage & cost" },
  { slug: "audit", label: "Audit" },
  { slug: "controls", label: "Controls" },
] as const;

export function orgTabHref(orgId: string, slug: string): string {
  return slug ? `/admin/orgs/${orgId}/${slug}` : `/admin/orgs/${orgId}`;
}

export function isOrgTabActive(pathname: string, orgId: string, slug: string): boolean {
  const href = orgTabHref(orgId, slug);
  if (!slug) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

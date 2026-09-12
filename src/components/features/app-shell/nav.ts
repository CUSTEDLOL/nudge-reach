import {
  BarChart3,
  BellRing,
  Blocks,
  BookOpen,
  Bot,
  House,
  Inbox,
  Megaphone,
  MessageSquareText,
  Plug,
  Settings,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppRole = "OWNER" | "ADMIN" | "AGENT";

export type NavKey =
  | "today"
  | "inbox"
  | "leads"
  | "front-desk"
  | "followups"
  | "campaigns"
  | "analytics"
  | "integrations"
  | "settings";

/**
 * A second level under a nav item, for a page whose sections are real
 * destinations rather than incidental tabs. Shown only while the parent is
 * the active section, so the rail stays calm.
 */
export type NavChild = {
  key: string;
  label: string;
  href: string;
  /** The `?tab=` value this child owns; omitted means the parent's default. */
  tab?: string;
};

export type NavItem = {
  key: NavKey;
  label: string;
  mobileLabel: string;
  href: string;
  icon: LucideIcon;
  activePrefixes: readonly string[];
  hideForAgent?: boolean;
  children?: readonly NavChild[];
};

export type NavGroup = {
  label: "Workspace" | "Automation" | "Insights" | "Manage";
  items: readonly NavItem[];
};

export type AppCommand = {
  label: string;
  href: string;
  group: "Navigate" | "Quick actions";
  icon: LucideIcon;
  keywords: readonly string[];
  hideForAgent?: boolean;
};

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        key: "today",
        label: "Home",
        mobileLabel: "Home",
        href: "/dashboard",
        icon: House,
        activePrefixes: ["/dashboard"],
      },
      {
        key: "inbox",
        label: "Inbox",
        mobileLabel: "Inbox",
        href: "/inbox",
        icon: Inbox,
        activePrefixes: ["/inbox"],
      },
      {
        key: "leads",
        label: "Leads",
        mobileLabel: "Leads",
        href: "/contacts",
        icon: Users,
        activePrefixes: ["/contacts", "/segments"],
      },
    ],
  },
  {
    label: "Automation",
    items: [
      {
        key: "front-desk",
        label: "AI Front Desk",
        mobileLabel: "Front Desk",
        href: "/agent",
        icon: Bot,
        activePrefixes: ["/agent", "/knowledge"],
        // Setup is a set-once persona screen that was hard to find behind a
        // tab; both faces of the page get their own entry in the rail.
        children: [
          { key: "training", label: "Training", href: "/agent" },
          { key: "setup", label: "Setup", href: "/agent?tab=setup", tab: "setup" },
        ],
      },
      {
        key: "followups",
        label: "Follow-ups",
        mobileLabel: "Follow-ups",
        href: "/automations",
        icon: BellRing,
        activePrefixes: ["/automations"],
        hideForAgent: true,
      },
      {
        key: "campaigns",
        label: "Campaigns",
        mobileLabel: "Campaigns",
        href: "/campaigns",
        icon: Megaphone,
        activePrefixes: ["/campaigns", "/templates"],
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        key: "analytics",
        label: "Analytics",
        mobileLabel: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        activePrefixes: ["/analytics"],
        hideForAgent: true,
      },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        key: "integrations",
        label: "Integrations",
        mobileLabel: "Integrations",
        href: "/integrations",
        icon: Blocks,
        activePrefixes: ["/integrations"],
        hideForAgent: true,
      },
      {
        key: "settings",
        label: "Settings",
        mobileLabel: "Settings",
        href: "/settings",
        icon: Settings,
        activePrefixes: ["/settings"],
        hideForAgent: true,
      },
    ],
  },
];

const MOBILE_PRIMARY_KEYS: readonly NavKey[] = [
  "today",
  "inbox",
  "front-desk",
  "leads",
];

export function navGroupsForRole(role: AppRole): NavGroup[] {
  return NAV_GROUPS.flatMap((group) => {
    const items = group.items.filter(
      (item) => role !== "AGENT" || !item.hideForAgent
    );
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

export function navItemsForRole(role: AppRole): NavItem[] {
  return navGroupsForRole(role).flatMap((group) => [...group.items]);
}

export function mobilePrimaryItemsForRole(role: AppRole): NavItem[] {
  const items = navItemsForRole(role);
  return MOBILE_PRIMARY_KEYS.flatMap((key) => {
    const item = items.find((candidate) => candidate.key === key);
    return item ? [item] : [];
  });
}

const QUICK_COMMANDS: readonly AppCommand[] = [
  {
    label: "Teach your Front Desk",
    href: "/agent/questionnaire",
    group: "Quick actions",
    icon: BookOpen,
    keywords: ["train", "knowledge", "answer"],
  },
  {
    label: "Try your Front Desk",
    href: "/inbox/try",
    group: "Quick actions",
    icon: MessageSquareText,
    keywords: ["test", "chat", "simulation"],
  },
  {
    label: "Add a lead",
    href: "/contacts?new=1",
    group: "Quick actions",
    icon: UserPlus,
    keywords: ["contact", "customer", "new"],
  },
  {
    label: "Connect an integration",
    href: "/integrations",
    group: "Quick actions",
    icon: Plug,
    keywords: ["calendar", "crm", "connect"],
    hideForAgent: true,
  },
];

export function commandsForRole(role: AppRole): AppCommand[] {
  const navigation = navItemsForRole(role).map<AppCommand>((item) => ({
    label: item.label,
    href: item.href,
    group: "Navigate",
    icon: item.icon,
    keywords: [item.mobileLabel, item.key],
  }));
  const actions = QUICK_COMMANDS.filter(
    (command) => role !== "AGENT" || !command.hideForAgent
  );
  return [...navigation, ...actions];
}

function cleanPathname(pathname: string): string {
  return pathname.split(/[?#]/, 1)[0] || "/";
}

function routeMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function activeNavKey(pathname: string): NavKey | null {
  const clean = cleanPathname(pathname);
  for (const item of NAV_GROUPS.flatMap((group) => group.items)) {
    if (item.activePrefixes.some((prefix) => routeMatches(clean, prefix))) {
      return item.key;
    }
  }
  return null;
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return activeNavKey(pathname) === item.key;
}

/**
 * Which child of an active nav item is the current one. The parent's own href
 * (no `tab`) is the default, so /agent with no query highlights Training.
 */
export function isNavChildActive(
  child: NavChild,
  currentTab: string | null
): boolean {
  return child.tab ? child.tab === currentTab : !currentTab;
}

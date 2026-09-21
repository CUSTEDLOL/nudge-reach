import {
  BarChart3,
  BellRing,
  Blocks,
  BookOpen,
  Bot,
  CalendarCheck,
  FileText,
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
export type AppShellMode = "standard" | "trial";

export type NavKey =
  | "today"
  | "inbox"
  | "bookings"
  | "leads"
  | "front-desk"
  | "followups"
  | "campaigns"
  | "templates"
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
  /**
   * Extra routes this child owns, so a sub-page still highlights its parent
   * row. Defaults to the href alone. Longest match wins across siblings.
   */
  activePrefixes?: readonly string[];
};

export type NavItem = {
  key: NavKey;
  label: string;
  mobileLabel: string;
  href: string;
  icon: LucideIcon;
  activePrefixes: readonly string[];
  hideForAgent?: boolean;
  tourTarget?: string;
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
        // Every appointment the AI took, on the business's clock. Until
        // 2026-09-17 a booking was only a count on Home and a line in a chat.
        key: "bookings",
        label: "Bookings",
        mobileLabel: "Bookings",
        href: "/bookings",
        icon: CalendarCheck,
        activePrefixes: ["/bookings"],
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
        // Everything about the AI employee lives here — what it knows, how it
        // behaves, its phone line and its abilities. Voice and Actions used to
        // sit in Settings, which meant setting up the AI meant visiting two
        // unrelated sections (founder feedback, 2026-09-16).
        children: [
          {
            key: "training",
            label: "Training",
            href: "/agent",
            activePrefixes: ["/agent", "/knowledge"],
          },
          { key: "setup", label: "Setup", href: "/agent/setup" },
          { key: "voice", label: "Voice", href: "/agent/voice" },
          { key: "actions", label: "Actions", href: "/agent/actions" },
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
        activePrefixes: ["/campaigns"],
      },
      {
        // Templates are shared by campaigns, follow-ups and inbox replies, so
        // they get their own home — filed under Campaigns, editing a follow-up's
        // wording lit up the wrong section (founder feedback, 2026-09-18).
        key: "templates",
        label: "Templates",
        mobileLabel: "Templates",
        href: "/templates",
        icon: FileText,
        activePrefixes: ["/templates"],
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
        label: "Apps",
        mobileLabel: "Apps",
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

export const TRIAL_NAV_ITEMS = [
  {
    key: "inbox",
    label: "Inbox",
    mobileLabel: "Inbox",
    href: "/dashboard",
    icon: Inbox,
    activePrefixes: ["/dashboard", "/inbox/try"],
    tourTarget: "nav-home",
  },
  {
    key: "front-desk",
    label: "Train AI",
    mobileLabel: "Train",
    href: "/agent",
    icon: BookOpen,
    activePrefixes: ["/agent"],
    tourTarget: "nav-train",
  },
] satisfies readonly NavItem[];

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

export function navGroupsForMode(
  mode: AppShellMode,
  role: AppRole,
): NavGroup[] {
  if (mode === "trial") {
    return [{ label: "Workspace", items: TRIAL_NAV_ITEMS }];
  }
  return navGroupsForRole(role);
}

export function navItemsForMode(
  mode: AppShellMode,
  role: AppRole,
): NavItem[] {
  return navGroupsForMode(mode, role).flatMap((group) => [...group.items]);
}

export function mobilePrimaryItemsForRole(role: AppRole): NavItem[] {
  const items = navItemsForRole(role);
  return MOBILE_PRIMARY_KEYS.flatMap((key) => {
    const item = items.find((candidate) => candidate.key === key);
    return item ? [item] : [];
  });
}

export function mobilePrimaryItemsForMode(
  mode: AppShellMode,
  role: AppRole,
): NavItem[] {
  if (mode === "trial") return [...TRIAL_NAV_ITEMS];
  return mobilePrimaryItemsForRole(role);
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
    label: "Connect an app",
    href: "/integrations",
    group: "Quick actions",
    icon: Plug,
    keywords: ["calendar", "crm", "connect", "zapier", "integration"],
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

export function commandsForMode(
  mode: AppShellMode,
  role: AppRole,
): AppCommand[] {
  if (mode === "standard") return commandsForRole(role);
  return navItemsForMode(mode, role).map<AppCommand>((item) => ({
    label: item.label,
    href: item.href,
    group: "Navigate",
    icon: item.icon,
    keywords: [item.mobileLabel, item.key],
  }));
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
  const clean = cleanPathname(pathname);
  return item.activePrefixes.some((prefix) => routeMatches(clean, prefix));
}

/**
 * Which child of an active nav item is the current page. Longest matching
 * prefix wins, so /agent/voice lands on Voice rather than on Training's
 * broader /agent — and a sub-page like /agent/questionnaire still highlights
 * the row it belongs to instead of leaving the whole list looking inactive.
 */
export function activeNavChildKey(item: NavItem, pathname: string): string | null {
  const clean = cleanPathname(pathname);
  let bestKey: string | null = null;
  let bestLength = -1;

  for (const child of item.children ?? []) {
    for (const prefix of child.activePrefixes ?? [child.href]) {
      if (routeMatches(clean, prefix) && prefix.length > bestLength) {
        bestKey = child.key;
        bestLength = prefix.length;
      }
    }
  }

  return bestKey;
}

import {
  Bell,
  Building2,
  Cpu,
  CreditCard,
  Database,
  Globe,
  Phone,
  PhoneCall,
  ScrollText,
  Users,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type SettingsItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type SettingsGroup = {
  label: "Workspace" | "Channels & AI" | "Account";
  items: readonly SettingsItem[];
};

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/settings/general", label: "General", icon: Building2 },
      { href: "/settings/team", label: "Team", icon: Users },
      { href: "/settings/concierge", label: "Concierge", icon: Wand2 },
    ],
  },
  {
    label: "Channels & AI",
    items: [
      { href: "/settings/whatsapp", label: "WhatsApp", icon: Phone },
      { href: "/settings/voice", label: "Voice", icon: PhoneCall },
      { href: "/settings/custom-actions", label: "Agent actions", icon: Zap },
      { href: "/settings/ai", label: "AI model", icon: Cpu },
      { href: "/settings/widget", label: "Website widget", icon: Globe },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings/notifications", label: "Notifications", icon: Bell },
      { href: "/settings/billing", label: "Billing", icon: CreditCard },
      { href: "/settings/data", label: "Data", icon: Database },
      { href: "/settings/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

export const SETTINGS_ITEMS = SETTINGS_GROUPS.flatMap((group) => group.items);

export function activeSettingsHref(pathname: string): string {
  return (
    SETTINGS_ITEMS.find(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`)
    )?.href ?? "/settings/general"
  );
}

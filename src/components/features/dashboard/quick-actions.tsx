import Link from "next/link";
import {
  Blocks,
  BookOpen,
  MessageSquareText,
  Megaphone,
  Phone,
  Upload,
  type LucideIcon,
} from "lucide-react";

/**
 * The six jobs an owner actually comes here to do. They all live in the
 * sidebar too, but two or three levels down — the point of this row is that
 * nobody has to go looking. Pure presentation; what to show is decided by
 * `buildQuickActions` so it can be unit tested.
 */

export type QuickActionKey =
  | "teach"
  | "try"
  | "import"
  | "campaign"
  | "apps"
  | "voice";

export interface QuickAction {
  key: QuickActionKey;
  label: string;
  hint: string;
  href: string;
}

const ICONS: Record<QuickActionKey, LucideIcon> = {
  teach: BookOpen,
  try: MessageSquareText,
  import: Upload,
  campaign: Megaphone,
  apps: Blocks,
  voice: Phone,
};

export function buildQuickActions(input: {
  role: "OWNER" | "ADMIN" | "AGENT";
  hasVoice: boolean;
  knowledgeTaught: boolean;
  hasContacts: boolean;
}): QuickAction[] {
  const actions: QuickAction[] = [
    {
      key: "teach",
      label: input.knowledgeTaught ? "Teach it more" : "Teach your AI",
      hint: input.knowledgeTaught
        ? "Add facts it still gets asked about"
        : "Answer once, it answers forever",
      href: "/agent",
    },
    {
      key: "try",
      label: "Try a conversation",
      hint: "Message it as a customer would",
      href: "/inbox/try",
    },
  ];

  // An agent can neither import a list nor change what the workspace connects.
  if (input.role !== "AGENT") {
    actions.push({
      key: "import",
      label: input.hasContacts ? "Add customers" : "Import customers",
      hint: "Only people who opted in",
      href: "/contacts",
    });
    actions.push({
      key: "campaign",
      label: "Send a campaign",
      hint: "An offer or a reminder",
      href: "/campaigns/new",
    });
    actions.push({
      key: "apps",
      label: "Connect apps",
      hint: "Calendar, CRM, Zapier and more",
      href: "/integrations",
    });
    if (input.hasVoice) {
      actions.push({
        key: "voice",
        label: "Call your AI",
        hint: "Hear it answer the phone",
        href: "/agent/voice",
      });
    }
  }

  return actions;
}

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <section aria-labelledby="quick-actions-heading" className="min-w-0">
      <h2
        id="quick-actions-heading"
        className="mb-3 text-lg font-semibold tracking-tight text-neutral-950"
      >
        Jump back in
      </h2>
      <ul className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {actions.map((action) => {
          const Icon = ICONS[action.key];
          return (
            <li key={action.key} className="min-w-0">
              <Link
                href={action.href}
                className="flex h-full min-h-[104px] flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-3.5 outline-none transition-colors duration-150 hover:border-neutral-300 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-400/60"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight text-neutral-950">
                    {action.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-neutral-500">
                    {action.hint}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

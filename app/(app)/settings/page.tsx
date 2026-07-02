import type { Metadata } from "next";
import Link from "next/link";
import { Bot, ChevronRight, Phone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

const sections = [
  {
    href: "/settings/whatsapp",
    icon: Phone,
    title: "WhatsApp connection",
    description: "Connect your WhatsApp Business account or run in simulation.",
  },
  {
    href: "/settings/agent",
    icon: Bot,
    title: "AI assistant",
    description: "Configure how the assistant replies to your customers.",
  },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace, team and channel configuration. More sections are being assembled."
      />
      <div className="grid max-w-2xl gap-4">
        {sections.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
          >
            <Card className="flex items-center gap-4 p-5 transition-shadow duration-200 group-hover:shadow-lift">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-neutral-900">
                  {title}
                </h2>
                <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-neutral-300 transition-colors duration-150 group-hover:text-neutral-500"
                aria-hidden
              />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

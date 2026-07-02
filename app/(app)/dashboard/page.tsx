import Link from "next/link";
import { requireOrgContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const { org, email, userId } = await requireOrgContext();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Hello, ${org.name} 👋`}
        description="Here's your workspace at a glance."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-neutral-500">
            Foundation check (Phase 0)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-neutral-800">
            <li>✅ Signed in as {email || userId}</li>
            <li>
              ✅ Org row in database: <span className="font-mono">{org.id}</span>
            </li>
            <li>
              ✅ Send mode: <span className="font-mono">{env.SEND_MODE}</span>
            </li>
          </ul>
          <p className="mt-4 text-sm text-neutral-500">
            Next up: campaign generation from a product photo.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-neutral-500">Quick links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/campaigns/new" className={buttonVariants()}>
              ✨ New campaign
            </Link>
            <Link
              href="/campaigns"
              className={buttonVariants({ variant: "secondary" })}
            >
              📣 Campaigns
            </Link>
            <Link
              href="/contacts"
              className={buttonVariants({ variant: "secondary" })}
            >
              👥 Customers & audiences
            </Link>
            <Link
              href="/conversations"
              className={buttonVariants({ variant: "secondary" })}
            >
              💬 Conversations
            </Link>
            <Link
              href="/settings/agent"
              className={buttonVariants({ variant: "secondary" })}
            >
              🤖 WhatsApp assistant
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

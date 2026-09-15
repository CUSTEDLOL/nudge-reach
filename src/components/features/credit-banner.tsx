import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CREDITS_EXHAUSTED_MESSAGE } from "@/modules/billing/credits";

/**
 * One line at the top of the inbox and billing pages while a metered org's
 * platform-paid AI is paused (credit ledger). Server component, no client JS;
 * the page decides with `creditsExhausted(org.id)`.
 */
export function CreditBanner() {
  return (
    <Card
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50 px-4 py-3"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <Badge tone="warning">AI paused</Badge>
      <p className="min-w-0 flex-1 text-sm text-amber-900">{CREDITS_EXHAUSTED_MESSAGE}</p>
      <Link
        href="/settings/billing"
        className="text-sm font-semibold text-amber-900 underline underline-offset-2"
      >
        Top up
      </Link>
    </Card>
  );
}

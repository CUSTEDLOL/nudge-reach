"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { OpeningHours } from "@/modules/calendar/hours";
import { HoursEditor } from "./hours-editor";
import { saveOpeningHoursAction, type ActionResult } from "./actions";

/**
 * Opening hours, on the page where someone configuring availability looks.
 * They used to sit on the AI's Setup page among persona fields, which is why
 * owners never found them — and they are not persona: they are the only thing
 * standing between a free 3 am calendar slot and a booked 3 am appointment.
 */
export function OpeningHoursCard({
  initial,
  canEdit,
}: {
  initial: OpeningHours | null;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await saveOpeningHoursAction(formData);
      toast({ description: result.message, tone: result.ok ? "success" : "error" });
      return result;
    },
    null
  );

  return (
    <Card className="mt-8 p-5">
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">
            When you&apos;re open
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Your AI only offers and takes appointments inside these hours.
          </p>
        </div>

        <HoursEditor initial={initial} disabled={!canEdit || pending} />

        {canEdit && (
          <div>
            <Button type="submit" size="sm" loading={pending}>
              Save hours
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Megaphone, Trash2, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createAudience, deleteAudience, type ActionResult } from "./actions";
import { Feedback } from "./forms";
import type { AudienceRow } from "./types";

/**
 * Static send lists. Kept as-is per spec §M3 — dynamic segments are filters
 * (lib/segments) that M4 materializes into an Audience at send time.
 */
export function AudiencesSection({
  audiences,
  optedInContacts,
  canManage,
}: {
  audiences: AudienceRow[];
  optedInContacts: { id: string; name: string; phoneE164: string }[];
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AudienceRow | null>(null);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Audiences</CardTitle>
            <CardDescription>
              Fixed groups of opted-in customers to send a campaign to.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCreating(true)}
          >
            <Users className="h-3.5 w-3.5" aria-hidden />
            New audience
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {audiences.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
            No audiences yet — create one, or select contacts in the table and
            use “Add to audience”.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {audiences.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="text-sm font-medium text-neutral-800">
                  {a.name}
                </span>
                <span className="text-xs text-neutral-400">
                  {a.memberCount} customer{a.memberCount === 1 ? "" : "s"}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <Link
                    href={`/campaigns/new?audienceId=${a.id}`}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    <Megaphone className="h-3.5 w-3.5" aria-hidden />
                    Use in campaign
                  </Link>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setDeleting(a)}
                      aria-label={`Delete audience ${a.name}`}
                      className="rounded-lg p-1.5 text-neutral-400 outline-none transition-colors duration-150 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-brand-400/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New audience"
        description="A group of customers to send a campaign to."
      >
        <CreateAudienceForm
          contacts={optedInContacts}
          onDone={() => setCreating(false)}
        />
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete audience “${deleting?.name}”?`}
        description="The contacts themselves are kept — only the group is removed."
        confirmLabel="Delete audience"
        tone="danger"
        onConfirm={async () => {
          if (!deleting) return;
          const fd = new FormData();
          fd.set("audienceId", deleting.id);
          const res = await deleteAudience(fd);
          toast({ description: res.message, tone: res.ok ? "success" : "error" });
        }}
      />
    </Card>
  );
}

export function CreateAudienceForm({
  contacts,
  onDone,
}: {
  contacts: { id: string; name: string; phoneE164: string }[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [result, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const res = await createAudience(formData);
      if (res.ok) {
        toast({ description: res.message, tone: "success" });
        onDone();
      }
      return res;
    },
    null
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Audience name" htmlFor="audience-name" required>
        <Input
          id="audience-name"
          name="name"
          required
          placeholder="Regular customers"
        />
      </Field>
      <fieldset className="max-h-52 overflow-y-auto rounded-lg border border-neutral-200 p-3">
        <legend className="px-1 text-sm font-medium text-neutral-700">
          Who&apos;s in it? (opted-in contacts only)
        </legend>
        {contacts.length === 0 && (
          <p className="text-sm text-neutral-500">
            No opted-in contacts yet — add some first.
          </p>
        )}
        {contacts.map((c) => (
          <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
            <input
              type="checkbox"
              name="contactIds"
              value={c.id}
              className="accent-brand-600"
            />
            {c.name}{" "}
            <span className="font-mono text-xs text-neutral-400">
              {c.phoneE164}
            </span>
          </label>
        ))}
      </fieldset>
      <Feedback result={result} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {pending ? "Creating…" : "Create audience"}
        </Button>
      </div>
    </form>
  );
}

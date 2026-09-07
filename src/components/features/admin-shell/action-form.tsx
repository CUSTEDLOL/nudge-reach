"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export type ActionFn = (formData: FormData) => Promise<{ ok: boolean; message: string }>;

/**
 * The one form pattern for founder mutations: fields → optional confirm
 * dialog (with a reason box for sensitive changes) → server action → toast.
 * Keeps every control page free of per-form plumbing.
 */
export function ActionForm({
  action,
  hidden = {},
  children,
  submitLabel,
  variant = "secondary",
  confirm,
  askReason = false,
  disabled,
  className,
}: {
  action: ActionFn;
  /** Hidden inputs (orgId etc.). */
  hidden?: Record<string, string>;
  children?: ReactNode;
  submitLabel: string;
  variant?: ButtonVariant;
  /** When set, a confirm dialog with this title/description precedes the call. */
  confirm?: { title: ReactNode; description?: ReactNode; danger?: boolean };
  /** Show a "reason" field inside the confirm dialog (stored in the audit row). */
  askReason?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pendingForm, setPendingForm] = useState<FormData | null>(null);

  function run(fd: FormData) {
    for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
    if (askReason) fd.set("reason", reason);
    startTransition(async () => {
      const res = await action(fd);
      toast({ description: res.message, tone: res.ok ? "success" : "error" });
      if (res.ok) setReason("");
    });
  }

  return (
    <>
      <form
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (confirm) {
            setPendingForm(fd);
            setOpen(true);
          } else {
            run(fd);
          }
        }}
      >
        {children}
        <Button type="submit" variant={variant} size="sm" loading={pending} disabled={disabled}>
          {submitLabel}
        </Button>
      </form>
      {confirm && (
        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          title={confirm.title}
          tone={confirm.danger ? "danger" : "default"}
          confirmLabel={submitLabel}
          description={
            <div className="space-y-3">
              {confirm.description && <p>{confirm.description}</p>}
              {askReason && (
                <label className="block text-left">
                  <span className="text-xs font-medium text-neutral-600">
                    Reason (goes in the org&apos;s audit log)
                  </span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                    placeholder="e.g. pilot extended after call with owner"
                  />
                </label>
              )}
            </div>
          }
          onConfirm={() => {
            if (pendingForm) run(pendingForm);
          }}
        />
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ActionForm, type ActionFn } from "./action-form";
import { SetupLinkPanel } from "./setup-link-panel";
import type { OwnerSetupLink } from "@/modules/orgs/owner-setup";

/**
 * Founder-only: create a client's workspace after they pay on the demo call.
 * Collapsed by default so the directory stays the point of the page.
 *
 * The owner never receives a password. They get an invite to this email and
 * choose their own on first sign-in.
 */

const field =
  "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-800 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200";
const label = "block text-xs font-semibold uppercase tracking-wide text-neutral-500";

export function NewWorkspace({
  action,
  countries,
  plans,
}: {
  action: ActionFn;
  countries: { code: string; label: string; currency: string }[];
  plans: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [setupLink, setSetupLink] = useState<OwnerSetupLink | null>(null);

  if (!open) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New workspace
        </button>
      </div>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">
            {setupLink ? "Workspace created" : "New workspace"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            {setupLink
              ? "Send this private link to the owner so they can choose a password and start onboarding."
              : "Creates the workspace on the plan they paid for and a 7-day owner setup link. Email is sent when delivery is configured."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {setupLink ? (
        <div className="mt-4 space-y-3">
          <SetupLinkPanel setupLink={setupLink} />
          <button
            type="button"
            onClick={() => setSetupLink(null)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create another workspace
          </button>
        </div>
      ) : (
      <ActionForm
        action={action}
        submitLabel="Create workspace and invite the owner"
        variant="primary"
        className="mt-4"
        confirm={{
          title: "Create this workspace?",
          description:
            "A private 7-day setup link will be created. Check the plan and owner email first.",
        }}
        onSuccess={(result) => {
          if (result.setupLink) setSetupLink(result.setupLink);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={label}>Business name</span>
            <input
              name="name"
              required
              minLength={2}
              placeholder="Aster Skin Clinic"
              className={`${field} mt-1.5`}
            />
          </label>
          <label>
            <span className={label}>Owner email</span>
            <input
              name="ownerEmail"
              type="email"
              required
              placeholder="owner@asterskin.in"
              className={`${field} mt-1.5`}
            />
          </label>
          <label>
            <span className={label}>Country</span>
            <select name="country" defaultValue="IN" className={`${field} mt-1.5`}>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} · {c.currency}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={label}>Plan they paid for</span>
            <select name="plan" defaultValue="growth" className={`${field} mt-1.5`}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </ActionForm>
      )}
    </section>
  );
}

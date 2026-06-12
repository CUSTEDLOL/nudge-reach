"use client";

import { useActionState } from "react";
import {
  addContact,
  createAudience,
  importContactsCsv,
  type ActionResult,
} from "@/app/contacts/actions";

const initial: ActionResult | null = null;

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      className={`mt-2 rounded-lg px-3 py-2 text-sm ${
        result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      {result.message}
    </p>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500";
const buttonCls =
  "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";

export function AddContactForm() {
  const [result, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      addContact(formData),
    initial
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm font-medium text-neutral-700">
        Name
        <input name="name" required className={inputCls} placeholder="Priya Sharma" />
      </label>
      <label className="text-sm font-medium text-neutral-700">
        WhatsApp number
        <input
          name="phone"
          required
          className={inputCls}
          placeholder="98765 43210"
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="optedIn" className="mt-0.5" />
        <span>
          This customer <strong>said yes</strong> to getting WhatsApp messages
          from my shop
        </span>
      </label>
      <label className="text-sm font-medium text-neutral-700">
        How did they say yes?
        <select name="optInSource" className={inputCls} defaultValue="in_store">
          <option value="in_store">In my shop</option>
          <option value="whatsapp">They messaged me on WhatsApp</option>
          <option value="website">On my website</option>
          <option value="manual">Other</option>
        </select>
      </label>
      <button type="submit" disabled={pending} className={buttonCls}>
        {pending ? "Adding…" : "Add contact"}
      </button>
      <Feedback result={result} />
    </form>
  );
}

export function CsvImportForm() {
  const [result, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      importContactsCsv(formData),
    initial
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm font-medium text-neutral-700">
        Paste your list — one customer per line, like:{" "}
        <span className="font-mono text-xs text-neutral-500">
          Priya, 9876543210
        </span>
        <textarea
          name="csv"
          required
          rows={5}
          className={inputCls + " font-mono text-xs"}
          placeholder={"Priya, 9876543210\nRahul, 9123456780"}
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="consentConfirmed" required className="mt-0.5" />
        <span>
          I confirm <strong>every person on this list said yes</strong> to
          WhatsApp messages from my shop. (Bought lists get your number banned.)
        </span>
      </label>
      <button type="submit" disabled={pending} className={buttonCls}>
        {pending ? "Importing…" : "Import contacts"}
      </button>
      <Feedback result={result} />
    </form>
  );
}

export function CreateAudienceForm({
  contacts,
}: {
  contacts: { id: string; name: string; phoneE164: string }[];
}) {
  const [result, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      createAudience(formData),
    initial
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm font-medium text-neutral-700">
        Audience name
        <input
          name="name"
          required
          className={inputCls}
          placeholder="Regular customers"
        />
      </label>
      <fieldset className="max-h-44 overflow-y-auto rounded-lg border border-neutral-200 p-3">
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
            <input type="checkbox" name="contactIds" value={c.id} />
            {c.name}{" "}
            <span className="font-mono text-xs text-neutral-400">
              {c.phoneE164}
            </span>
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={pending} className={buttonCls}>
        {pending ? "Creating…" : "Create audience"}
      </button>
      <Feedback result={result} />
    </form>
  );
}

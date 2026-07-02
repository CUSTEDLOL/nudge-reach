"use client";

import { useActionState, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tags, Upload, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TagPill } from "@/components/ui/tag-pill";
import { useToast } from "@/components/ui/toast";
import { addContact, importContactsCsv, type ActionResult } from "./actions";
import { STAGES, type TagInfo } from "./types";
import { TagsDrawer } from "./tags-drawer";

const initial: ActionResult | null = null;

export function Feedback({ result }: { result: ActionResult | null }) {
  if (!result || result.ok) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {result.message}
    </p>
  );
}

/** Toast on success + run the follow-up (usually: close the modal). */
function useOnSuccess(result: ActionResult | null, onSuccess: () => void) {
  const { toast } = useToast();
  useEffect(() => {
    if (result?.ok) {
      toast({ description: result.message, tone: "success" });
      onSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
}

/**
 * Page-header actions: Manage tags / Import CSV / Add contact. The add-contact
 * modal is URL-driven (?new=1) so the topbar, empty states and deep links can
 * all open it.
 */
export function ContactsToolbar({
  tags,
  canManageTags,
}: {
  tags: TagInfo[];
  canManageTags: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const openNew = searchParams.get("new") === "1";
  const openImport = searchParams.get("import") === "1";
  const openTags = searchParams.get("tags") === "1";

  const setParam = useCallback(
    (key: string, on: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (on) params.set(key, "1");
      else params.delete(key);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <>
      <Button variant="ghost" onClick={() => setParam("tags", true)}>
        <Tags className="h-4 w-4" aria-hidden />
        Manage tags
      </Button>
      <Button variant="secondary" onClick={() => setParam("import", true)}>
        <Upload className="h-4 w-4" aria-hidden />
        Import CSV
      </Button>
      <Button onClick={() => setParam("new", true)}>
        <UserPlus className="h-4 w-4" aria-hidden />
        Add contact
      </Button>

      <Modal
        open={openNew}
        onClose={() => setParam("new", false)}
        title="Add a customer"
        description="One person, added by hand."
      >
        <AddContactForm tags={tags} onDone={() => setParam("new", false)} />
      </Modal>

      <Modal
        open={openImport}
        onClose={() => setParam("import", false)}
        title="Import a list"
        description="Paste from a spreadsheet — every row becomes a contact."
      >
        <CsvImportForm onDone={() => setParam("import", false)} />
      </Modal>

      <TagsDrawer
        open={openTags}
        onClose={() => setParam("tags", false)}
        tags={tags}
        canManage={canManageTags}
      />
    </>
  );
}

export function AddContactForm({
  tags,
  onDone,
}: {
  tags: TagInfo[];
  onDone: () => void;
}) {
  const [result, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      addContact(formData),
    initial
  );
  useOnSuccess(result, onDone);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="add-name" required>
          <Input id="add-name" name="name" required placeholder="Priya Sharma" />
        </Field>
        <Field
          label="WhatsApp number"
          htmlFor="add-phone"
          required
          hint="10-digit numbers are treated as +91."
        >
          <Input id="add-phone" name="phone" required placeholder="98765 43210" />
        </Field>
        <Field label="Email (optional)" htmlFor="add-email">
          <Input
            id="add-email"
            name="email"
            type="email"
            placeholder="priya@gmail.com"
          />
        </Field>
        <Field label="Stage" htmlFor="add-stage">
          <Select id="add-stage" name="leadStage" defaultValue="NEW">
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {tags.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-neutral-700">
            Tags
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <label key={t.id} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="tagIds"
                  value={t.id}
                  className="peer sr-only"
                />
                <TagPill
                  label={t.name}
                  color={t.color}
                  className="opacity-50 ring-1 ring-transparent transition peer-checked:opacity-100 peer-checked:ring-brand-400 peer-focus-visible:ring-brand-400"
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="optedIn" className="mt-0.5" />
        <span>
          This customer <strong>said yes</strong> to getting WhatsApp messages
          from my shop
        </span>
      </label>
      <Field label="How did they say yes?" htmlFor="add-source">
        <Select id="add-source" name="optInSource" defaultValue="in_store">
          <option value="in_store">In my shop</option>
          <option value="whatsapp">They messaged me on WhatsApp</option>
          <option value="website">On my website</option>
          <option value="manual">Other</option>
        </Select>
      </Field>

      <Feedback result={result} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {pending ? "Adding…" : "Add contact"}
        </Button>
      </div>
    </form>
  );
}

export function CsvImportForm({ onDone }: { onDone: () => void }) {
  const [result, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      importContactsCsv(formData),
    initial
  );
  useOnSuccess(result, onDone);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="Paste your list — one customer per line"
        htmlFor="csv-body"
        hint={
          <>
            <span className="font-mono">Name, phone, email</span> — email is
            optional. Example:{" "}
            <span className="font-mono">Priya, 9876543210, priya@gmail.com</span>
          </>
        }
      >
        <Textarea
          id="csv-body"
          name="csv"
          required
          rows={6}
          className="font-mono text-xs"
          placeholder={"Priya, 9876543210, priya@gmail.com\nRahul, 9123456780"}
        />
      </Field>
      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          name="consentConfirmed"
          required
          className="mt-0.5"
        />
        <span>
          I confirm <strong>every person on this list said yes</strong> to
          WhatsApp messages from my shop. (Bought lists get your number banned.)
        </span>
      </label>

      <Feedback result={result} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {pending ? "Importing…" : "Import contacts"}
        </Button>
      </div>
    </form>
  );
}

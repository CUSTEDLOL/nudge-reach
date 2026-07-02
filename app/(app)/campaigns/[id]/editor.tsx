"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Plus, X } from "lucide-react";
import type { CampaignButton, CampaignContent } from "@/lib/campaign/schema";
import { WhatsappPreview } from "@/components/whatsapp-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  deleteCampaignAction,
  updateCampaignAction,
  type ActionResult,
} from "../actions";

/** Friendly chip for the canonical {{1}} personalization variable. */
function NameChip() {
  return (
    <span className="inline-flex items-center rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-brand-700">
      {"{{name}}"}
    </span>
  );
}

export function CampaignEditor({
  campaignId,
  initialContent,
  photoUrl,
}: {
  campaignId: string;
  initialContent: CampaignContent;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [content, setContent] = useState<CampaignContent>(initialContent);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [result, save, saving] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      updateCampaignAction(formData),
    null
  );

  function set<K extends keyof CampaignContent>(
    key: K,
    value: CampaignContent[K]
  ) {
    setContent((prev) => ({ ...prev, [key]: value }));
  }

  function setButton(i: number, button: CampaignButton | null) {
    setContent((prev) => {
      const buttons = [...prev.buttons];
      if (button === null) buttons.splice(i, 1);
      else buttons[i] = button;
      return { ...prev, buttons: buttons.slice(0, 3) };
    });
  }

  async function handleDelete() {
    const formData = new FormData();
    formData.set("campaignId", campaignId);
    const res = await deleteCampaignAction(formData);
    if (res.ok) {
      toast({ description: res.message, tone: "success" });
      router.push("/campaigns");
    } else {
      toast({ description: res.message, tone: "error" });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-6">
        <form action={save} className="flex flex-col gap-4">
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="campaignAngle" value={content.campaignAngle} />
          <input type="hidden" name="imageTreatment" value={content.imageTreatment} />
          <input type="hidden" name="notes" value={content.notes} />

          <Field label="Product name" htmlFor="edit-productName">
            <Input
              id="edit-productName"
              name="productName"
              value={content.productName}
              onChange={(e) => set("productName", e.target.value)}
            />
          </Field>

          <Field
            label={
              <>
                Headline{" "}
                <span className="font-normal text-neutral-400">
                  (bold, max 60)
                </span>
              </>
            }
            htmlFor="edit-header"
          >
            <Input
              id="edit-header"
              name="header"
              maxLength={60}
              value={content.header}
              onChange={(e) => set("header", e.target.value)}
            />
          </Field>

          <Field
            label="Message"
            htmlFor="edit-body"
            hint={
              <>
                <NameChip /> is each customer&apos;s first name — WhatsApp
                stores it as <span className="font-mono">{"{{1}}"}</span>, and
                it can&apos;t be removed.
              </>
            }
          >
            <Textarea
              id="edit-body"
              name="body"
              rows={5}
              maxLength={1024}
              value={content.body}
              onChange={(e) => set("body", e.target.value)}
            />
          </Field>

          <Field
            label="Footer"
            htmlFor="edit-footer"
            hint="The opt-out line stays in — Meta requires it."
          >
            <Input
              id="edit-footer"
              name="footer"
              maxLength={60}
              value={content.footer}
              onChange={(e) => set("footer", e.target.value)}
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium text-neutral-700">
              Buttons{" "}
              <span className="font-normal text-neutral-400">(up to 3)</span>
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {content.buttons.map((button, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    name={`button${i}Type`}
                    value={button.type}
                    aria-label={`Button ${i + 1} type`}
                    className="w-32 shrink-0"
                    onChange={(e) =>
                      setButton(
                        i,
                        e.target.value === "URL"
                          ? { type: "URL", text: button.text, url: "url" in button ? button.url : "" }
                          : { type: "QUICK_REPLY", text: button.text }
                      )
                    }
                  >
                    <option value="URL">Link</option>
                    <option value="QUICK_REPLY">Quick reply</option>
                  </Select>
                  <Input
                    name={`button${i}Text`}
                    value={button.text}
                    maxLength={25}
                    placeholder="Button text"
                    aria-label={`Button ${i + 1} text`}
                    onChange={(e) =>
                      setButton(i, { ...button, text: e.target.value })
                    }
                  />
                  {button.type === "URL" && (
                    <Input
                      name={`button${i}Url`}
                      value={button.url}
                      placeholder="https://…"
                      aria-label={`Button ${i + 1} URL`}
                      className="font-mono text-xs"
                      onChange={(e) =>
                        setButton(i, { ...button, url: e.target.value })
                      }
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setButton(i, null)}
                    className="rounded-lg p-1.5 text-neutral-400 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-brand-400/50"
                    aria-label={`Remove button ${i + 1}`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
              {content.buttons.length < 3 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    setButton(content.buttons.length, {
                      type: "QUICK_REPLY",
                      text: "",
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add button
                </Button>
              )}
            </div>
          </fieldset>

          <Field
            label="Preview name"
            htmlFor="edit-sampleName"
            hint="Sample customer name shown in the preview."
          >
            <Input
              id="edit-sampleName"
              name="sampleName"
              maxLength={40}
              value={content.sampleName}
              onChange={(e) => set("sampleName", e.target.value)}
            />
          </Field>

          <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-4">
            <Button type="submit" loading={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-neutral-400 hover:text-red-600"
              onClick={() => setConfirmDelete(true)}
            >
              Delete campaign
            </Button>
          </div>

          {result && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                result.ok
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {result.message}
            </p>
          )}
        </form>
      </Card>

      <div>
        <WhatsappPreview content={content} photoUrl={photoUrl} />
        {(content.imageTreatment || content.notes) && (
          <Card className="mt-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-none">
            <p className="flex items-center gap-1.5 font-semibold">
              <Lightbulb className="h-4 w-4" aria-hidden />
              Tips from your AI marketer
            </p>
            {content.imageTreatment && (
              <p className="mt-1.5">{content.imageTreatment}</p>
            )}
            {content.notes && <p className="mt-1.5">{content.notes}</p>}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this campaign?"
        description="The draft, its template submissions and its send history are removed. This can't be undone."
        confirmLabel="Delete campaign"
        tone="danger"
      />
    </div>
  );
}

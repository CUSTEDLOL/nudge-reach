"use client";

import { useActionState, useState } from "react";
import {
  deleteCampaignAction,
  updateCampaignAction,
  type ActionResult,
} from "@/app/campaigns/actions";
import type { CampaignButton, CampaignContent } from "@/lib/campaign/schema";
import { WhatsappPreview } from "@/components/whatsapp-preview";

const inputCls =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500";

export function CampaignEditor({
  campaignId,
  initialContent,
  photoUrl,
}: {
  campaignId: string;
  initialContent: CampaignContent;
  photoUrl: string | null;
}) {
  const [content, setContent] = useState<CampaignContent>(initialContent);
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

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form
        action={save}
        className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="campaignId" value={campaignId} />
        <input type="hidden" name="campaignAngle" value={content.campaignAngle} />
        <input type="hidden" name="imageTreatment" value={content.imageTreatment} />
        <input type="hidden" name="notes" value={content.notes} />

        <div className="flex flex-col gap-4">
          <label className="text-sm font-medium text-neutral-700">
            Product name
            <input
              name="productName"
              value={content.productName}
              onChange={(e) => set("productName", e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="text-sm font-medium text-neutral-700">
            Headline <span className="font-normal text-neutral-400">(bold, max 60)</span>
            <input
              name="header"
              maxLength={60}
              value={content.header}
              onChange={(e) => set("header", e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="text-sm font-medium text-neutral-700">
            Message{" "}
            <span className="font-normal text-neutral-400">
              ({"{{1}}"} becomes the customer&apos;s name)
            </span>
            <textarea
              name="body"
              rows={5}
              maxLength={1024}
              value={content.body}
              onChange={(e) => set("body", e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="text-sm font-medium text-neutral-700">
            Footer{" "}
            <span className="font-normal text-neutral-400">
              (the opt-out line stays in — Meta requires it)
            </span>
            <input
              name="footer"
              maxLength={60}
              value={content.footer}
              onChange={(e) => set("footer", e.target.value)}
              className={inputCls}
            />
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-neutral-700">
              Buttons <span className="font-normal text-neutral-400">(up to 3)</span>
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {content.buttons.map((button, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    name={`button${i}Type`}
                    value={button.type}
                    onChange={(e) =>
                      setButton(
                        i,
                        e.target.value === "URL"
                          ? { type: "URL", text: button.text, url: "url" in button ? button.url : "" }
                          : { type: "QUICK_REPLY", text: button.text }
                      )
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-2 text-xs"
                  >
                    <option value="URL">Link</option>
                    <option value="QUICK_REPLY">Quick reply</option>
                  </select>
                  <input
                    name={`button${i}Text`}
                    value={button.text}
                    maxLength={25}
                    placeholder="Button text"
                    onChange={(e) =>
                      setButton(i, { ...button, text: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  {button.type === "URL" && (
                    <input
                      name={`button${i}Url`}
                      value={button.url}
                      placeholder="https://…"
                      onChange={(e) =>
                        setButton(i, { ...button, url: e.target.value })
                      }
                      className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono text-xs"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setButton(i, null)}
                    className="text-neutral-400 hover:text-red-600"
                    aria-label="Remove button"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {content.buttons.length < 3 && (
                <button
                  type="button"
                  onClick={() =>
                    setButton(content.buttons.length, {
                      type: "QUICK_REPLY",
                      text: "",
                    })
                  }
                  className="self-start text-sm text-emerald-700 hover:underline"
                >
                  + Add button
                </button>
              )}
            </div>
          </fieldset>

          <label className="text-sm font-medium text-neutral-700">
            Preview name{" "}
            <span className="font-normal text-neutral-400">
              (sample customer name shown in the preview)
            </span>
            <input
              name="sampleName"
              maxLength={40}
              value={content.sampleName}
              onChange={(e) => set("sampleName", e.target.value)}
              className={inputCls}
            />
          </label>

          <div className="mt-2 flex items-center justify-between">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="submit"
              formAction={deleteCampaignAction}
              className="text-sm text-neutral-400 hover:text-red-600 hover:underline"
            >
              Delete campaign
            </button>
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
        </div>
      </form>

      <div>
        <WhatsappPreview content={content} photoUrl={photoUrl} />
        {(content.imageTreatment || content.notes) && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">💡 Tips from your AI marketer</p>
            {content.imageTreatment && (
              <p className="mt-1">📷 {content.imageTreatment}</p>
            )}
            {content.notes && <p className="mt-1">📝 {content.notes}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

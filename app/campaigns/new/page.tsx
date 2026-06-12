"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  generateCampaignAction,
  type ActionResult,
} from "@/app/campaigns/actions";

const MAX_PHOTO_BYTES = 4.5 * 1024 * 1024;

export default function NewCampaignPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [result, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      generateCampaignAction(formData),
    null
  );

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-sm text-neutral-500">
          <Link href="/campaigns" className="hover:underline">
            ← Campaigns
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900">
          New campaign
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Add a photo of your product — that&apos;s it. We&apos;ll write the
          message, the offer and the buttons.
        </p>

        <form
          action={action}
          className="mt-6 flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">
              Product photo
            </span>
            <div className="mt-2 flex items-center gap-4">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Your product"
                  className="h-24 w-24 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 text-2xl">
                  📸
                </div>
              )}
              <input
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                className="text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && file.size > MAX_PHOTO_BYTES) {
                    setSizeError(
                      "That photo is over 4 MB — most phones can resize it from the share menu, or pick a smaller one."
                    );
                    setPreview(null);
                    e.target.value = "";
                    return;
                  }
                  setSizeError(null);
                  setPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-neutral-700">
              Or tell us about it{" "}
              <span className="font-normal text-neutral-400">
                (optional — helps even with a photo)
              </span>
            </span>
            <textarea
              name="description"
              rows={3}
              className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="Cotton summer kurtas, new stock, want to give 20% off this week"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? "✨ Writing your campaign… (about 10 seconds)" : "✨ Generate my campaign"}
          </button>

          {sizeError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {sizeError}
            </p>
          )}
          {result && !result.ok && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {result.message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

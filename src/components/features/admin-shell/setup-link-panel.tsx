"use client";

import { useState } from "react";
import { Check, Clock3, Copy, ExternalLink } from "lucide-react";
import type { OwnerSetupLink } from "@/modules/orgs/owner-setup";

export function SetupLinkPanel({ setupLink }: { setupLink: OwnerSetupLink }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const expires = new Date(setupLink.expiresAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(setupLink.url);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-950">Owner setup link</p>
          <p className="mt-1 text-sm text-emerald-900/70">
            Reserved for {setupLink.email}
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-900/65">
          <Clock3 className="h-3.5 w-3.5" aria-hidden />
          Expires {expires}
        </p>
      </div>

      <label className="mt-4 block">
        <span className="sr-only">Owner setup URL</span>
        <input
          value={setupLink.url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          className="h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 font-mono text-xs text-neutral-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-black px-3.5 text-sm font-semibold text-white hover:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
        >
          {copyState === "copied" ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copyState === "copied" ? "Copied" : "Copy setup link"}
        </button>
        <a
          href={setupLink.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-100/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Open link
        </a>
      </div>

      <p aria-live="polite" className="mt-2 min-h-5 text-xs text-emerald-900/70">
        {copyState === "error"
          ? "Copy failed. Select the URL above and copy it manually."
          : "Share this private link only with the invited owner. It works once."}
      </p>
    </div>
  );
}


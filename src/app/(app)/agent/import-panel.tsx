"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Globe, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  approveAllDraftsAction,
  approveDraftAction,
  discardDraftAction,
  importFileAction,
  importGbpAction,
  importWebsiteAction,
} from "./actions";

export interface DraftFact {
  id: string;
  category: string;
  fact: string;
  condition: string | null;
}

/**
 * Import-first training: paste a website URL → the crawler drafts facts →
 * the owner confirms them card-by-card (or all at once). Confirm, don't
 * enter: nothing here asks the owner to type knowledge from scratch.
 */
export function ImportPanel({
  drafts,
  canEdit,
}: {
  drafts: DraftFact[];
  canEdit: boolean;
}) {
  const [url, setUrl] = useState("");
  const [gbpQuery, setGbpQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      const r = await fn();
      setMessage(r.message);
    });

  function onFilePicked(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    run(() => importFileAction(fd));
    // Allow re-picking the same file after a failure.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Globe className="h-4 w-4 text-brand-600" aria-hidden />
          Teach it from what you already have
        </div>
        <p className="mt-1 text-[13.5px] text-neutral-500">
          Paste your website, or upload a menu, price list or brochure — we
          read it into facts you approve below. Nothing goes live until you
          say so.
        </p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (gbpQuery.trim()) run(() => importGbpAction(gbpQuery));
          }}
        >
          <Input
            value={gbpQuery}
            onChange={(e) => setGbpQuery(e.target.value)}
            placeholder="Your business name + city (finds your Google listing)"
            className="min-w-0 flex-1"
            disabled={!canEdit || pending}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!canEdit || pending || !gbpQuery.trim()}
          >
            {pending ? "Searching…" : "Find my listing"}
          </Button>
        </form>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) run(() => importWebsiteAction(url));
          }}
        >
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourbusiness.com"
            className="min-w-0 flex-1"
            disabled={!canEdit || pending}
          />
          <Button type="submit" size="sm" disabled={!canEdit || pending || !url.trim()}>
            {pending ? "Reading…" : "Import"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canEdit || pending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden />
            Upload menu / PDF
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onFilePicked(e.target.files?.[0])}
          />
        </form>
        {message && (
          <p className="mt-2 text-[13px] font-medium text-neutral-600">{message}</p>
        )}
      </Card>

      {drafts.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">
              Review imported facts
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                {drafts.length}
              </span>
            </h3>
            <Button
              size="sm"
              variant="secondary"
              disabled={!canEdit || pending}
              onClick={() => run(() => approveAllDraftsAction())}
            >
              Approve all
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {drafts.map((d) => (
              <Card key={d.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{d.category.replace("_", " ")}</Badge>
                    {d.condition && (
                      <span className="text-xs text-neutral-500">
                        when: {d.condition}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[14px] leading-snug text-neutral-800">
                    {d.fact}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    aria-label="Approve fact"
                    disabled={!canEdit || pending}
                    onClick={() => run(() => approveDraftAction(d.id))}
                  >
                    <Check className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Discard fact"
                    disabled={!canEdit || pending}
                    onClick={() => run(() => discardDraftAction(d.id))}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

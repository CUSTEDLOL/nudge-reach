"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  importFileAction,
  importGbpAction,
  importWebsiteAction,
  type ActionResult,
} from "@/app/(app)/agent/training-actions";

const MAX_TRIAL_PDF_BYTES = 4 * 1024 * 1024;

export async function uploadTrialPdfFiles(
  files: readonly File[],
  remaining: number,
  upload: (formData: FormData) => Promise<ActionResult> = importFileAction,
): Promise<ActionResult> {
  const allowed = Math.max(0, Math.floor(remaining));
  if (allowed === 0) {
    return {
      ok: false,
      message: "Your free trial includes three text PDF imports.",
    };
  }

  const selected = files.slice(0, allowed);
  if (selected.length === 0) {
    return { ok: false, message: "Choose at least one text PDF." };
  }

  let uploaded = 0;
  for (const file of selected) {
    if (file.type !== "application/pdf") {
      return { ok: false, message: "Choose text PDFs only." };
    }
    if (file.size > MAX_TRIAL_PDF_BYTES) {
      return { ok: false, message: `${file.name} is too large. Text PDFs must be 4 MB or smaller.` };
    }

    const formData = new FormData();
    formData.set("file", file);
    const result = await upload(formData);
    if (!result.ok) {
      return uploaded === 0
        ? result
        : {
            ok: false,
            message: `Uploaded ${uploaded}, then stopped: ${result.message}`,
          };
    }
    uploaded += 1;
  }

  return {
    ok: true,
    message: `Uploaded ${uploaded} PDF${uploaded === 1 ? "" : "s"}. Review the facts below.`,
  };
}

export function TrialKnowledgeSources({
  canEdit,
  webImportsUsed,
  webImportLimit,
  fileImportsUsed,
  fileImportLimit,
}: {
  canEdit: boolean;
  webImportsUsed: number;
  webImportLimit: number;
  fileImportsUsed: number;
  fileImportLimit: number;
}) {
  const router = useRouter();
  const [website, setWebsite] = useState("");
  const [googleListing, setGoogleListing] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const webLimitReached = webImportsUsed >= webImportLimit;
  const fileLimitReached = fileImportsUsed >= fileImportLimit;

  function runImport(work: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await work();
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="border-t border-neutral-200 py-7" aria-labelledby="trial-web-heading">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 id="trial-web-heading" className="text-base font-semibold text-neutral-900">
            Website or Google listing
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Import public business details as drafts. These two options share one import.
          </p>
        </div>
        <span className="shrink-0 text-sm tabular-nums text-neutral-500">
          {webImportsUsed}/{webImportLimit}
        </span>
      </div>

      <div className="mt-5 max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            runImport(() => importWebsiteAction(website));
          }}
        >
          <Field
            label="Website address"
            htmlFor="trial-website"
            hint="Use the main page where your services are explained."
          >
            <Input
              id="trial-website"
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://northstar.example"
              disabled={!canEdit || pending || webLimitReached}
            />
          </Field>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={!canEdit || pending || webLimitReached || website.trim().length === 0}
          >
            Import website
          </Button>
        </form>

        <details className="mt-5 border-t border-neutral-100 pt-4">
          <summary className="cursor-pointer text-sm font-medium text-neutral-700">
            Use a Google Business Profile instead
          </summary>
          <form
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault();
              runImport(() => importGbpAction(googleListing));
            }}
          >
            <Field
              label="Google Business Profile"
              htmlFor="trial-google-listing"
              hint="Optional. Enter your business name and city."
            >
              <Input
                id="trial-google-listing"
                value={googleListing}
                onChange={(event) => setGoogleListing(event.target.value)}
                placeholder="Northstar Services, Singapore"
                disabled={!canEdit || pending || webLimitReached}
              />
            </Field>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              className="mt-3"
              disabled={!canEdit || pending || webLimitReached || googleListing.trim().length === 0}
            >
              Import Google listing
            </Button>
          </form>
        </details>
      </div>

      {webLimitReached && (
        <p className="mt-3 text-sm text-neutral-500">
          Website or Google import used. You can still add PDFs and facts below.
        </p>
      )}

      <div className="mt-7 border-t border-neutral-100 pt-7">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Text PDFs</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Add price lists, policies, service guides, or FAQs. Text PDF, 4 MB max each.
            </p>
          </div>
          <span className="shrink-0 text-sm tabular-nums text-neutral-500">
            {fileImportsUsed}/{fileImportLimit}
          </span>
        </div>
        <div className="mt-4 max-w-md">
          <Field label="Choose text PDFs" htmlFor="trial-pdfs">
            <Input
              id="trial-pdfs"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={!canEdit || pending || fileLimitReached}
              className="h-auto py-2 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-neutral-700"
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = "";
                runImport(() =>
                  uploadTrialPdfFiles(
                    files,
                    Math.max(0, fileImportLimit - fileImportsUsed),
                  ),
                );
              }}
            />
          </Field>
        </div>
        {fileLimitReached && (
          <p className="mt-3 text-sm text-neutral-500">
            All three PDF imports are used. Manual facts remain available.
          </p>
        )}
      </div>

      {message && (
        <p className="mt-4 text-sm text-neutral-600" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

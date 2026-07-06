"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AtSign, Lock, Plus, X } from "lucide-react";
import type { CampaignContent } from "@/modules/campaign/schema";
import { repairOptOutFooter } from "@/modules/campaign/guardrails";
import { slugifyTemplateName } from "@/modules/whatsapp/template";
import type { LibraryTemplateContent } from "@/modules/whatsapp/library";
import { WhatsappPreview } from "@/components/features/whatsapp-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { saveTemplateAction, type ActionResult } from "./actions";

type ButtonDraft = { type: "URL" | "QUICK_REPLY"; text: string; url: string };

const CATEGORY_HINT: Record<string, string> = {
  MARKETING: "Promotions and announcements. Needs customer opt-in and an opt-out footer.",
  UTILITY: "Order updates, reminders and account notices triggered by the customer.",
  AUTHENTICATION: "One-time passcodes only — keep the copy minimal.",
};

export function TemplateForm({
  template,
  readOnly = false,
}: {
  /** Existing template when editing; null when creating. */
  template: {
    id: string;
    status: string;
    category: string;
    language: string;
    content: LibraryTemplateContent;
  } | null;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const c = template?.content;

  const [displayName, setDisplayName] = useState(c?.productName ?? "");
  const [category, setCategory] = useState(template?.category ?? "MARKETING");
  const [language, setLanguage] = useState(template?.language ?? "en");
  const [headerType, setHeaderType] = useState(c?.headerType ?? "text");
  const [headerText, setHeaderText] = useState(c?.header ?? "");
  const [headerImageUrl, setHeaderImageUrl] = useState(c?.headerImageUrl ?? "");
  const [body, setBody] = useState(c?.body ?? "");
  const [footer, setFooter] = useState(c?.footer ?? "");
  const [sampleName, setSampleName] = useState(c?.sampleName ?? "Priya");
  const [buttons, setButtons] = useState<ButtonDraft[]>(
    (c?.buttons ?? []).map((b) => ({
      type: b.type,
      text: b.text,
      url: b.type === "URL" ? b.url : "",
    }))
  );

  const [result, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      saveTemplateAction(formData),
    null
  );

  useEffect(() => {
    if (!result) return;
    toast({
      tone: result.ok ? "success" : "error",
      description: result.message,
    });
  }, [result, toast]);

  const slug = displayName.trim()
    ? slugifyTemplateName(displayName, language)
    : null;
  const isMarketing = category === "MARKETING";
  const hasVariable = body.includes("{{1}}");

  function insertVariable() {
    const el = bodyRef.current;
    const token = "{{1}}";
    if (!el) {
      setBody((prev) => `${prev}${token}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    setBody(next.slice(0, 1024));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function setButton(i: number, button: ButtonDraft | null) {
    setButtons((prev) => {
      const next = [...prev];
      if (button === null) next.splice(i, 1);
      else next[i] = button;
      return next.slice(0, 3);
    });
  }

  const previewContent: CampaignContent = useMemo(
    () => ({
      productName: displayName || "Your template",
      campaignAngle: "",
      header:
        headerType === "text"
          ? headerText
          : headerType === "image"
            ? displayName
            : "",
      body: body || "Your message will appear here…",
      footer: isMarketing ? repairOptOutFooter(footer) : footer,
      buttons: buttons
        .filter((b) => b.text.trim())
        .map((b) =>
          b.type === "URL"
            ? { type: "URL" as const, text: b.text, url: b.url || "https://example.com" }
            : { type: "QUICK_REPLY" as const, text: b.text }
        ),
      sampleName: sampleName || "Priya",
      imageTreatment: "",
      notes: "",
    }),
    [displayName, headerType, headerText, body, footer, isMarketing, buttons, sampleName]
  );

  const lockedFooter = repairOptOutFooter(footer);
  const canSubmitForReview =
    !template || template.status === "DRAFT" || template.status === "REJECTED";

  return (
    <form action={formAction} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_360px]">
      {template && <input type="hidden" name="id" value={template.id} />}

      <Card className="p-6">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Template name"
              htmlFor="tpl-name"
              hint={
                slug ? (
                  <>
                    WhatsApp ID:{" "}
                    <span className="font-mono text-neutral-600">{slug}</span>
                  </>
                ) : (
                  "A friendly name — the WhatsApp ID is generated for you."
                )
              }
              required
            >
              <Input
                id="tpl-name"
                name="displayName"
                value={displayName}
                maxLength={120}
                placeholder="Diwali offer"
                disabled={readOnly}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category" htmlFor="tpl-category">
                <Select
                  id="tpl-category"
                  name="category"
                  value={category}
                  disabled={readOnly}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </Select>
              </Field>
              <Field label="Language" htmlFor="tpl-language">
                <Select
                  id="tpl-language"
                  name="language"
                  value={language}
                  disabled={readOnly}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                </Select>
              </Field>
            </div>
          </div>
          <p className="-mt-3 text-xs text-neutral-500">
            {CATEGORY_HINT[category]}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
            <Field label="Header" htmlFor="tpl-header-type">
              <Select
                id="tpl-header-type"
                name="headerType"
                value={headerType}
                disabled={readOnly}
                onChange={(e) =>
                  setHeaderType(e.target.value as "none" | "text" | "image")
                }
              >
                <option value="none">None</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
              </Select>
            </Field>
            {headerType === "text" && (
              <Field
                label="Header text"
                htmlFor="tpl-header-text"
                hint={`${headerText.length}/60`}
                required
              >
                <Input
                  id="tpl-header-text"
                  name="headerText"
                  value={headerText}
                  maxLength={60}
                  placeholder="Festive collection has arrived ✨"
                  disabled={readOnly}
                  onChange={(e) => setHeaderText(e.target.value)}
                />
              </Field>
            )}
            {headerType === "image" && (
              <Field
                label="Header image URL"
                htmlFor="tpl-header-image"
                hint="A public https:// image. The template name appears as a bold first line."
                required
              >
                <Input
                  id="tpl-header-image"
                  name="headerImageUrl"
                  value={headerImageUrl}
                  placeholder="https://…/product.jpg"
                  disabled={readOnly}
                  onChange={(e) => setHeaderImageUrl(e.target.value)}
                />
              </Field>
            )}
            {headerType === "none" && (
              <p className="self-center pt-5 text-xs text-neutral-400">
                The message starts directly with the body.
              </p>
            )}
          </div>
          {/* Keep hidden inputs so untouched header fields still post. */}
          {headerType !== "text" && (
            <input type="hidden" name="headerText" value={headerText} />
          )}
          {headerType !== "image" && (
            <input type="hidden" name="headerImageUrl" value={headerImageUrl} />
          )}

          <Field
            label={
              <span className="flex items-center gap-2">
                Body
                <Badge tone="brand" className="font-mono">
                  {"{{1}}"} = customer name
                </Badge>
              </span>
            }
            htmlFor="tpl-body"
            hint={`${body.length}/1024`}
            required
          >
            <Textarea
              ref={bodyRef}
              id="tpl-body"
              name="body"
              rows={6}
              value={body}
              maxLength={1024}
              placeholder="Hi {{1}}, our new collection just landed…"
              disabled={readOnly}
              onChange={(e) => setBody(e.target.value)}
            />
            {!readOnly && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={insertVariable}
                  disabled={hasVariable}
                >
                  <AtSign className="h-3.5 w-3.5" aria-hidden />
                  {hasVariable ? "Name variable added" : "Insert name variable"}
                </Button>
              </div>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Sample name"
              htmlFor="tpl-sample"
              hint="Shown in the preview and sent to Meta as the example value."
            >
              <Input
                id="tpl-sample"
                name="sampleName"
                value={sampleName}
                maxLength={40}
                disabled={readOnly}
                onChange={(e) => setSampleName(e.target.value)}
              />
            </Field>
            <Field
              label="Footer"
              htmlFor="tpl-footer"
              hint={
                isMarketing
                  ? undefined
                  : "Optional small print under the message."
              }
            >
              <Input
                id="tpl-footer"
                name="footer"
                value={footer}
                maxLength={60}
                placeholder={isMarketing ? "Added automatically if left empty" : "Optional"}
                disabled={readOnly}
                onChange={(e) => setFooter(e.target.value)}
              />
            </Field>
          </div>
          {isMarketing && (
            <div className="-mt-2 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-brand-800">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <p>
                Marketing templates must offer an opt-out — Meta rejects them
                otherwise. We append it automatically, so this will send as{" "}
                <span className="font-medium">“{lockedFooter}”</span>.
              </p>
            </div>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-neutral-700">
              Buttons{" "}
              <span className="font-normal text-neutral-400">(up to 3)</span>
            </legend>
            {buttons.map((button, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  aria-label={`Button ${i + 1} type`}
                  className="w-36 shrink-0"
                  name={`button${i}Type`}
                  value={button.type}
                  disabled={readOnly}
                  onChange={(e) =>
                    setButton(i, {
                      ...button,
                      type: e.target.value as ButtonDraft["type"],
                    })
                  }
                >
                  <option value="QUICK_REPLY">Quick reply</option>
                  <option value="URL">Link</option>
                </Select>
                <Input
                  aria-label={`Button ${i + 1} text`}
                  name={`button${i}Text`}
                  value={button.text}
                  maxLength={25}
                  placeholder="Button text"
                  disabled={readOnly}
                  onChange={(e) => setButton(i, { ...button, text: e.target.value })}
                />
                {button.type === "URL" && (
                  <Input
                    aria-label={`Button ${i + 1} URL`}
                    name={`button${i}Url`}
                    value={button.url}
                    placeholder="https://…"
                    className="font-mono text-xs"
                    disabled={readOnly}
                    onChange={(e) => setButton(i, { ...button, url: e.target.value })}
                  />
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setButton(i, null)}
                    aria-label={`Remove button ${i + 1}`}
                    className="rounded-lg p-1.5 text-neutral-400 outline-none transition-colors duration-150 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-brand-400/50"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {!readOnly && buttons.length < 3 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() =>
                  setButton(buttons.length, {
                    type: "QUICK_REPLY",
                    text: "",
                    url: "",
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add button
              </Button>
            )}
          </fieldset>

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
              {canSubmitForReview && (
                <Button
                  type="submit"
                  name="intent"
                  value="submit"
                  loading={pending}
                >
                  Save &amp; submit for review
                </Button>
              )}
              <Button
                type="submit"
                name="intent"
                value="save"
                variant={canSubmitForReview ? "secondary" : "primary"}
                loading={pending}
              >
                Save draft
              </Button>
              {template && !canSubmitForReview && (
                <p className="text-xs text-neutral-500">
                  Saving moves this template back to draft — it needs Meta
                  approval again before use.
                </p>
              )}
            </div>
          )}

          {result && !result.ok && (
            <p
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {result.message}
            </p>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <WhatsappPreview
          content={previewContent}
          photoUrl={headerType === "image" ? headerImageUrl || null : null}
        />
        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Live preview</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 text-xs text-neutral-500">
            Exactly what your customer sees — {"{{1}}"} is replaced with the
            sample name “{sampleName || "Priya"}”.
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

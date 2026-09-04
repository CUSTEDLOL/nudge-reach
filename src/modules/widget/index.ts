import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { normalizePhoneE164 } from "@/lib/phone";

/**
 * E5 website widget (docs/plans/2026-09-04-enterprise-track.md §E5, scope F6:
 * a wa.me BUTTON, not live web chat). Config lives in Org.settings JSON (the
 * house pattern for per-org preferences). widgetKey is a random public id —
 * never the org id — and the public config endpoint exposes ONLY what the
 * button needs to render.
 */

export interface WidgetConfig {
  enabled: boolean;
  /** The business's public WhatsApp number, E.164 (wa.me needs real digits). */
  phoneE164: string;
  /** Pre-filled first message for the customer. */
  prefill: string;
  /** Floating button corner. */
  position: "right" | "left";
  /** Button color (hex). */
  color: string;
  /** Public random id used in the embed snippet + endpoints. */
  widgetKey: string;
}

const DEFAULTS: Omit<WidgetConfig, "widgetKey"> = {
  enabled: false,
  phoneE164: "",
  prefill: "Hi! I found you on your website.",
  position: "right",
  color: "#25D366",
};

export function newWidgetKey(): string {
  return `wk_${crypto.randomBytes(12).toString("hex")}`;
}

type OrgSettings = Record<string, unknown> & { widget?: Partial<WidgetConfig> };

/** The org's widget config, defaults filled in. Key created lazily on save. */
export async function getWidgetConfig(orgId: string): Promise<WidgetConfig | null> {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });
  if (!org) return null;
  const stored = ((org.settings as OrgSettings)?.widget ?? {}) as Partial<WidgetConfig>;
  return {
    ...DEFAULTS,
    ...stored,
    widgetKey: stored.widgetKey ?? "",
  };
}

export async function saveWidgetConfig(
  orgId: string,
  input: { enabled: boolean; phone: string; prefill: string; position: string; color: string },
  dialCode: string
): Promise<{ ok: boolean; message: string; config?: WidgetConfig }> {
  const phoneE164 = input.phone.trim()
    ? normalizePhoneE164(input.phone, dialCode)
    : null;
  if (input.enabled && !phoneE164) {
    return { ok: false, message: "Enter the WhatsApp number the button should open." };
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) {
    return { ok: false, message: "Pick a valid button color." };
  }
  const position = input.position === "left" ? "left" : "right";
  const prefill = input.prefill.slice(0, 200);

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });
  if (!org) return { ok: false, message: "Workspace not found." };
  const settings = (org.settings as OrgSettings) ?? {};
  const widget: WidgetConfig = {
    enabled: input.enabled,
    phoneE164: phoneE164 ?? "",
    prefill,
    position,
    color: input.color,
    widgetKey: settings.widget?.widgetKey || newWidgetKey(),
  };
  await prisma.org.update({
    where: { id: orgId },
    data: { settings: { ...settings, widget: { ...widget } } },
  });
  return { ok: true, message: "Widget saved.", config: widget };
}

/**
 * Public lookup by widget key. Returns ONLY render data; null for unknown or
 * disabled keys (the route 404s). Scans settings JSON — orgs are few enough;
 * revisit with a column if this ever shows up in slow queries.
 */
export async function getPublicWidgetByKey(widgetKey: string): Promise<{
  orgId: string;
  phoneE164: string;
  prefill: string;
  position: string;
  color: string;
} | null> {
  if (!/^wk_[0-9a-f]{24}$/.test(widgetKey)) return null;
  const org = await prisma.org.findFirst({
    where: { settings: { path: ["widget", "widgetKey"], equals: widgetKey } },
    select: { id: true, settings: true },
  });
  if (!org) return null;
  const widget = (org.settings as OrgSettings)?.widget;
  if (!widget?.enabled || !widget.phoneE164) return null;
  return {
    orgId: org.id,
    phoneE164: widget.phoneE164,
    prefill: widget.prefill ?? DEFAULTS.prefill,
    position: widget.position ?? DEFAULTS.position,
    color: widget.color ?? DEFAULTS.color,
  };
}

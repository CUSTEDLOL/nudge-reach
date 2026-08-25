import { env } from "@/lib/env";
import { getWhatsappCredentials } from "@/modules/whatsapp/accounts";

/**
 * Meta message-template API for an org's own WABA (live mode). Every client
 * connects its own number, so credentials are always per org — never the
 * platform env fallback.
 */

export interface MetaTemplateSubmission {
  name: string;
  language: string;
  category: string;
  components: unknown;
}

export interface MetaTemplateStatus {
  status: string;
  reason?: string;
  id?: string;
}

const NOT_CONNECTED =
  "Connect your WhatsApp number first — we do this with you on the setup call.";

function graph(path: string): string {
  return `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${path}`;
}

/** Library image headers store a public URL where Meta expects an uploaded
 * media handle; submitting that would be rejected with an opaque error. */
function hasImageUrlHeader(components: unknown): boolean {
  if (!Array.isArray(components)) return false;
  return components.some((c) => {
    if (!c || typeof c !== "object") return false;
    const comp = c as { type?: string; format?: string; example?: { header_handle?: string[] } };
    const handle = comp.example?.header_handle?.[0];
    return comp.type === "HEADER" && comp.format === "IMAGE" && /^https?:\/\//.test(handle ?? "");
  });
}

/** Submit a template for review. `existing` means Meta already has one with
 * this name — the caller should adopt Meta's current status instead. */
export async function createMetaTemplate(
  orgId: string,
  template: MetaTemplateSubmission
): Promise<{ id?: string; existing?: boolean }> {
  const creds = await getWhatsappCredentials(orgId);
  if (!creds) throw new Error(NOT_CONNECTED);
  if (hasImageUrlHeader(template.components)) {
    throw new Error(
      "Image headers aren't supported on live templates yet — switch the header to text and resubmit."
    );
  }
  const res = await fetch(graph(`${creds.wabaId}/message_templates`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: template.name,
      language: template.language,
      category: template.category,
      components: template.components,
    }),
  });
  const body = (await res.json().catch(() => null)) as {
    id?: string;
    error?: { message?: string; error_user_msg?: string };
  } | null;
  if (!res.ok) {
    const message =
      body?.error?.error_user_msg ??
      body?.error?.message ??
      `Meta rejected the submission (HTTP ${res.status}).`;
    if (/already exists/i.test(message)) return { existing: true };
    throw new Error(message);
  }
  return { id: body?.id };
}

/** Meta's current review status for a template name on the org's WABA. */
export async function fetchMetaTemplateStatus(
  orgId: string,
  name: string
): Promise<MetaTemplateStatus | null> {
  const creds = await getWhatsappCredentials(orgId);
  if (!creds) return null;
  const res = await fetch(
    graph(`${creds.wabaId}/message_templates?name=${encodeURIComponent(name)}`),
    { headers: { Authorization: `Bearer ${creds.accessToken}` } }
  );
  const body = (await res.json().catch(() => null)) as {
    data?: Array<{ id?: string; status?: string; rejected_reason?: string }>;
  } | null;
  const meta = body?.data?.[0];
  if (!res.ok || !meta?.status) return null;
  return { status: meta.status, reason: meta.rejected_reason, id: meta.id };
}

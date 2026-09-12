import { env } from "@/lib/env";

export type WhatsappConnectionInput = {
  displayName: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
};

export type WhatsappConnectionValidation =
  | { ok: true; value: WhatsappConnectionInput }
  | { ok: false; message: string };

const META_UNAVAILABLE =
  "Meta could not be reached. Nothing was saved. Try again.";

function normalize(input: WhatsappConnectionInput): WhatsappConnectionValidation {
  const value = {
    displayName: input.displayName.trim(),
    wabaId: input.wabaId.trim(),
    phoneNumberId: input.phoneNumberId.trim(),
    accessToken: input.accessToken.trim(),
  };

  if (value.displayName.length < 1 || value.displayName.length > 100) {
    return { ok: false, message: "Enter a display name between 1 and 100 characters." };
  }
  if (!/^\d{5,40}$/.test(value.wabaId)) {
    return { ok: false, message: "Enter a valid WhatsApp Business Account ID." };
  }
  if (!/^\d{5,40}$/.test(value.phoneNumberId)) {
    return { ok: false, message: "Enter a valid Phone Number ID." };
  }
  if (value.accessToken.length < 10 || value.accessToken.length > 4096) {
    return { ok: false, message: "Enter a valid Meta access token." };
  }
  return { ok: true, value };
}

function hasPhoneNumber(data: unknown, phoneNumberId: string): boolean | null {
  if (
    typeof data !== "object" ||
    data === null ||
    !("data" in data) ||
    !Array.isArray(data.data)
  ) {
    return null;
  }
  return data.data.some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "id" in entry &&
      entry.id === phoneNumberId
  );
}

/**
 * Verify that a Meta token can read the submitted WABA and that the submitted
 * Phone Number ID belongs to it. Simulation deliberately stops after local
 * validation so assisted onboarding remains demoable without external keys.
 */
export async function validateWhatsappConnection(
  input: WhatsappConnectionInput
): Promise<WhatsappConnectionValidation> {
  const normalized = normalize(input);
  if (!normalized.ok || env.SEND_MODE === "simulation") return normalized;

  const { wabaId, phoneNumberId, accessToken } = normalized.value;
  const apiVersion = env.WHATSAPP_API_VERSION || "v23.0";
  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/phone_numbers?fields=id&limit=100`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        message: "Meta rejected the access token. Check it and try again.",
      };
    }
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) {
        return {
          ok: false,
          message:
            "Meta rejected these WhatsApp credentials. Check the Business Account ID and token.",
        };
      }
      return { ok: false, message: META_UNAVAILABLE };
    }

    const containsNumber = hasPhoneNumber(await response.json(), phoneNumberId);
    if (containsNumber === null) return { ok: false, message: META_UNAVAILABLE };
    if (!containsNumber) {
      return {
        ok: false,
        message:
          "That Phone Number ID is not registered under this WhatsApp Business Account.",
      };
    }
    return normalized;
  } catch {
    return { ok: false, message: META_UNAVAILABLE };
  }
}

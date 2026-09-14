const STORAGE_KEY = "nudge:first-touch:v1";
const MAX_VALUE_LENGTH = 200;

export type AttributionSnapshot = {
  landingPath: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  gaClientId?: string;
};

export type MarketingEvent =
  | {
      event: "demo_cta_click";
      surface: string;
      landing_path: string;
    }
  | {
      event: "generate_lead";
      lead_source: "cal";
      booking_uid?: string;
    }
  | {
      event: "generate_lead";
      lead_source: "access_form";
    }
  | {
      event: "cal_embed_error";
      surface: string;
    };

type FirstTouch = Omit<AttributionSnapshot, "gaClientId">;
type MarketingWindow = Window & { dataLayer?: object[] };

function limited(value: string | null | undefined) {
  return value ? value.slice(0, MAX_VALUE_LENGTH) : undefined;
}

function referrerOrigin(referrer: string) {
  if (!referrer) return undefined;

  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return limited(`${url.origin}/`);
  } catch {
    return undefined;
  }
}

function currentTouch(location: URL, referrer: string): FirstTouch {
  return {
    landingPath: limited(location.pathname) ?? "/",
    ...(referrerOrigin(referrer) ? { referrer: referrerOrigin(referrer) } : {}),
    ...(limited(location.searchParams.get("utm_source"))
      ? { utmSource: limited(location.searchParams.get("utm_source")) }
      : {}),
    ...(limited(location.searchParams.get("utm_medium"))
      ? { utmMedium: limited(location.searchParams.get("utm_medium")) }
      : {}),
    ...(limited(location.searchParams.get("utm_campaign"))
      ? { utmCampaign: limited(location.searchParams.get("utm_campaign")) }
      : {}),
  };
}

function storedTouch(value: string): FirstTouch | null {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") return null;

  const record = parsed as Record<string, unknown>;
  if (typeof record.landingPath !== "string") return null;

  const optional = (key: keyof FirstTouch) =>
    typeof record[key] === "string" ? limited(record[key]) : undefined;

  return {
    landingPath: limited(record.landingPath) ?? "/",
    ...(optional("referrer") ? { referrer: optional("referrer") } : {}),
    ...(optional("utmSource") ? { utmSource: optional("utmSource") } : {}),
    ...(optional("utmMedium") ? { utmMedium: optional("utmMedium") } : {}),
    ...(optional("utmCampaign")
      ? { utmCampaign: optional("utmCampaign") }
      : {}),
  };
}

function gaClientId(cookie: string) {
  const gaCookie = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("_ga="));
  if (!gaCookie) return undefined;

  const match = gaCookie.slice(4).match(/^GA\d+\.\d+\.(\d+\.\d+)$/);
  return limited(match?.[1]);
}

export function captureAttribution(
  location: URL,
  referrer: string,
  storage: Storage,
  cookie: string
): AttributionSnapshot {
  const current = currentTouch(location, referrer);
  const clientId = gaClientId(cookie);

  try {
    const existing = storage.getItem(STORAGE_KEY);
    const firstTouch = existing ? storedTouch(existing) ?? current : current;

    if (!existing) storage.setItem(STORAGE_KEY, JSON.stringify(firstTouch));

    return {
      ...firstTouch,
      ...(clientId ? { gaClientId: clientId } : {}),
    };
  } catch {
    return {
      ...current,
      ...(clientId ? { gaClientId: clientId } : {}),
    };
  }
}

export function calMetadata(attribution: AttributionSnapshot) {
  const config: Record<string, string> = {
    "metadata[landingPath]":
      limited(attribution.landingPath) ?? "/",
  };

  const fields = [
    ["utm_source", attribution.utmSource],
    ["utm_medium", attribution.utmMedium],
    ["utm_campaign", attribution.utmCampaign],
    ["metadata[referrer]", attribution.referrer],
    ["metadata[gaClientId]", attribution.gaClientId],
  ] as const;

  for (const [key, value] of fields) {
    const safeValue = limited(value);
    if (safeValue) config[key] = safeValue;
  }

  return config;
}

export function pushMarketingEvent(event: MarketingEvent) {
  try {
    if (typeof window === "undefined") return;
    const dataLayer = (window as MarketingWindow).dataLayer;
    if (Array.isArray(dataLayer)) dataLayer.push({ ...event });
  } catch {
    // Analytics must never block the user journey.
  }
}

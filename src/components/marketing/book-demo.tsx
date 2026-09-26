"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  calMetadata,
  captureAttribution,
  pushMarketingEvent,
} from "@/modules/marketing/analytics";
import { buttonCn, type ButtonSize, type ButtonVariant } from "./button";

/**
 * Cal.com element-click embed. A loaded embed intercepts the free-demo
 * link and opens its modal; the real href remains usable when scripts fail.
 * The official loader snippet is ported below and runs once per browser
 * lifecycle, lazily, when the first trigger mounts.
 */
const CAL_LINK = "hqnudge/request-your-free-demo";
const CAL_FALLBACK_URL = `https://cal.com/${CAL_LINK}`;
const CAL_NAMESPACE = "request-your-free-demo";
const CAL_STATIC_CONFIG = {
  layout: "month_view",
  useSlotsViewOnSmallScreen: "true",
} as const;
const CAL_CONFIG = JSON.stringify(CAL_STATIC_CONFIG);
const MARKETING_ATTRIBUTION_ENABLED =
  process.env.NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED === "true";
const SAFE_SURFACES = new Set([
  "navbar",
  "hero",
  "pricing",
  "clinic",
  "resource",
  "free-trial",
  "whatsapp-ai-automation",
  "whatsapp-lead-leakage-calculator",
  "footer",
  "unknown",
]);

const initializedCalWindows = new WeakSet<object>();
const MAX_DEDUPED_CAL_BOOKING_KEYS = 200;
const CAL_UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CAL_INSTANT_PATTERN = /^[0-9T:.+-]{1,64}Z?$/;

type BrowserAttributionContext = {
  locationHref: string;
  referrer: string;
  storage: Storage;
  cookie: string;
};

function safeSurface(surface: string) {
  return SAFE_SURFACES.has(surface) ? surface : "unknown";
}

function calBookingKeys(event: unknown) {
  const detail =
    event && typeof event === "object"
      ? (event as { detail?: unknown }).detail
      : undefined;
  const data =
    detail && typeof detail === "object"
      ? (detail as { data?: unknown }).data
      : undefined;
  if (!data || typeof data !== "object") return ["unkeyed"];

  const record = data as Record<string, unknown>;
  const keys: string[] = [];
  if (typeof record.uid === "string" && CAL_UID_PATTERN.test(record.uid)) {
    keys.push(`uid:${record.uid}`);
  }

  // Cal documents the dry-run event as the normal success payload without a
  // UID. The bounded, non-contact slot tuple lets either event arrive first
  // without emitting two aggregate conversions for the same completion.
  const startTime = record.startTime;
  const endTime = record.endTime;
  const eventTypeId = record.eventTypeId;
  if (
    typeof startTime === "string" &&
    CAL_INSTANT_PATTERN.test(startTime) &&
    typeof endTime === "string" &&
    CAL_INSTANT_PATTERN.test(endTime) &&
    typeof eventTypeId === "number" &&
    Number.isSafeInteger(eventTypeId) &&
    eventTypeId >= 0
  ) {
    keys.push(`slot:${eventTypeId}:${startTime}:${endTime}`);
  }

  return keys.length > 0 ? keys : ["unkeyed"];
}

export function trackDemoCta(
  surface: string,
  location: Pick<Location, "pathname">
) {
  pushMarketingEvent({
    event: "demo_cta_click",
    surface: safeSurface(surface),
    landing_path: location.pathname.slice(0, 200),
  });
}

export function initializeCalEmbed() {
  if (typeof window === "undefined") return;

  const w = window as any;
  if (initializedCalWindows.has(w)) return;

  try {
    const d = document;

    // Official Cal element-click loader, reformatted for TS. Queues API calls
    // until embed.js arrives, with per-namespace queues.
    w.Cal =
      w.Cal ||
      function (...args: any[]) {
        const cal = w.Cal;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          const script = d.createElement("script");
          script.src = "https://app.cal.com/embed/embed.js";
          script.onerror = () => {
            cal.loaded = false;
            cal.q = [];
            cal.ns = {};
            initializedCalWindows.delete(w);
          };
          d.head.appendChild(script);
          cal.loaded = true;
        }
        if (args[0] === "init") {
          const api: any = function (...apiArgs: any[]) {
            api.q.push(apiArgs);
          };
          const namespace = args[1];
          api.q = api.q || [];
          if (typeof namespace === "string") {
            cal.ns[namespace] = cal.ns[namespace] || api;
            api.q.push(args);
            cal.q.push(["initNamespace", namespace]);
          } else {
            cal.q.push(args);
          }
          return;
        }
        cal.q.push(args);
      };

    w.Cal("init", CAL_NAMESPACE, { origin: "https://app.cal.com" });
    w.Cal.config = w.Cal.config || {};
    w.Cal.config.forwardQueryParams = false;
    w.Cal.ns[CAL_NAMESPACE]("ui", {
      hideEventTypeDetails: false,
      layout: "month_view",
    });
    const seenBookingKeys = new Set<string>();
    const bookingSuccess = (event: unknown) => {
      const bookingKeys = calBookingKeys(event);
      if (bookingKeys.some((key) => seenBookingKeys.has(key))) return;
      for (const bookingKey of bookingKeys) {
        if (seenBookingKeys.size >= MAX_DEDUPED_CAL_BOOKING_KEYS) {
          const oldest = seenBookingKeys.values().next().value;
          if (typeof oldest === "string") seenBookingKeys.delete(oldest);
        }
        seenBookingKeys.add(bookingKey);
      }
      pushMarketingEvent({
        event: "generate_lead",
        lead_source: "cal",
      });
    };
    for (const action of [
      "bookingSuccessfulV2",
      "dryRunBookingSuccessfulV2",
    ]) {
      w.Cal.ns[CAL_NAMESPACE]("on", {
        action,
        callback: bookingSuccess,
      });
    }
    w.Cal.ns[CAL_NAMESPACE]("on", {
      action: "linkFailed",
      callback: () => {
        pushMarketingEvent({
          event: "cal_embed_error",
          surface: "cal_embed",
        });
      },
    });
    initializedCalWindows.add(w);
  } catch {
    initializedCalWindows.delete(w);
    // The anchor remains a direct Cal link and a later mount/click may retry.
  }
}

export function buildCalTriggerConfig(
  attributionEnabled: boolean,
  context?: BrowserAttributionContext
) {
  if (!attributionEnabled) return CAL_CONFIG;

  try {
    const browser = context ?? {
      locationHref: window.location.href,
      referrer: document.referrer,
      storage: window.localStorage,
      cookie: document.cookie,
    };
    const attribution = captureAttribution(
      new URL(browser.locationHref),
      browser.referrer,
      browser.storage,
      browser.cookie
    );
    return JSON.stringify({
      ...CAL_STATIC_CONFIG,
      ...calMetadata(attribution),
    });
  } catch {
    return CAL_CONFIG;
  }
}

/**
 * The demo CTA. With `variant`, it wears the marketing CTA skin; without, it
 * takes whatever `className` the call site composes (nav or inline links).
 */
export function BookDemoButton({
  children = "Book a Free Demo",
  variant,
  size = "md",
  className,
  surface = "unknown",
  "aria-label": ariaLabel,
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  surface?: string;
  "aria-label"?: string;
}) {
  const triggerRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    try {
      triggerRef.current?.setAttribute(
        "data-cal-config",
        buildCalTriggerConfig(MARKETING_ATTRIBUTION_ENABLED)
      );
    } catch {
      // Attribute enrichment is optional; the static direct link still works.
    }
    initializeCalEmbed();
  }, []);

  return (
    <a
      ref={triggerRef}
      href={CAL_FALLBACK_URL}
      aria-label={ariaLabel}
      onClick={() => {
        trackDemoCta(surface, window.location);
        initializeCalEmbed();
      }}
      data-cal-link={CAL_LINK}
      data-cal-namespace={CAL_NAMESPACE}
      data-cal-config={CAL_CONFIG}
      className={
        variant ? buttonCn(variant, size, className) : cn(className)
      }
    >
      {children}
    </a>
  );
}

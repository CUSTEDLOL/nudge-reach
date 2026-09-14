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
 * Cal.com element-click embed. Any `BookDemoButton` opens the hqnudge/30min
 * booking modal in place — no route change. The official loader snippet is
 * ported below and runs once (module singleton), lazily, when the first
 * trigger mounts — so any page that renders a trigger gets the embed with
 * no layout wiring.
 */
const CAL_LINK = "hqnudge/30min";
const CAL_NAMESPACE = "30min";
const CAL_STATIC_CONFIG = {
  layout: "month_view",
  useSlotsViewOnSmallScreen: "true",
} as const;
const CAL_CONFIG = JSON.stringify(CAL_STATIC_CONFIG);
const SAFE_SURFACES = new Set([
  "navbar",
  "hero",
  "pricing",
  "clinic",
  "resource",
  "footer",
  "unknown",
]);

let calStarted = false;

function safeSurface(surface: string) {
  return SAFE_SURFACES.has(surface) ? surface : "unknown";
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
  if (calStarted || typeof window === "undefined") return;
  calStarted = true;

  try {
    const w = window as any;
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
          d.head.appendChild(d.createElement("script")).src =
            "https://app.cal.com/embed/embed.js";
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
    w.Cal.ns[CAL_NAMESPACE]("on", {
      action: "bookingSuccessfulV2",
      callback: () => {
        pushMarketingEvent({
          event: "generate_lead",
          lead_source: "cal",
        });
      },
    });
    w.Cal.ns[CAL_NAMESPACE]("on", {
      action: "linkFailed",
      callback: () => {
        pushMarketingEvent({
          event: "cal_embed_error",
          surface: "cal_embed",
        });
      },
    });
  } catch {
    // A blocked embed or browser API must not make the CTA unusable.
  }
}

function browserCalConfig() {
  try {
    const attribution = captureAttribution(
      new URL(window.location.href),
      document.referrer,
      window.localStorage,
      document.cookie
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
 * The demo CTA. With `variant`, it wears the marketing button skin; without,
 * it's unstyled and takes whatever `className` the call site composes (nav
 * links, inline text links).
 */
export function BookDemoButton({
  children = "Book a Demo",
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    triggerRef.current?.setAttribute("data-cal-config", browserCalConfig());
    initializeCalEmbed();
  }, []);

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label={ariaLabel}
      onClick={() => trackDemoCta(surface, window.location)}
      data-cal-link={CAL_LINK}
      data-cal-namespace={CAL_NAMESPACE}
      data-cal-config={CAL_CONFIG}
      className={
        variant ? buttonCn(variant, size, className) : cn(className)
      }
    >
      {children}
    </button>
  );
}

"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";
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
const CAL_CONFIG = '{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}';

let calStarted = false;

function initCal() {
  if (calStarted || typeof window === "undefined") return;
  calStarted = true;

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
  w.Cal.config.forwardQueryParams = true;
  w.Cal.ns[CAL_NAMESPACE]("ui", {
    hideEventTypeDetails: false,
    layout: "month_view",
  });
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
  "aria-label": ariaLabel,
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  "aria-label"?: string;
}) {
  useEffect(initCal, []);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
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

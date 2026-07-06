"use client";

/**
 * Single GSAP entry point for the landing. Everything scroll-driven imports
 * from here so the plugin registration happens exactly once, client-side.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/** True when the motion gate allowed animation (JS on + no reduced-motion). */
export function motionAllowed(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("jsm")
  );
}

export { gsap, ScrollTrigger, useGSAP };

"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { SmoothScroll } from "./smooth-scroll";
import { CursorAura, DayRail, Grain } from "./ambient";
import { ScrollTrigger, motionAllowed } from "./gsap";
import { shift } from "./progress";
import { detectQuality, webglSupported, type Quality } from "./world/quality";

const World = dynamic(() => import("./world/world"), { ssr: false });

/**
 * The one client orchestrator for the Night Shift page:
 *  - Lenis smooth scroll (SmoothScroll)
 *  - the three ScrollTriggers that write the shared `shift` refs
 *  - the day/night attribute flip on the [data-shift] page wrapper
 *  - the persistent WebGL world, mounted on idle when motion + WebGL allow
 */
export function Experience() {
  const [quality, setQuality] = useState<Quality | null>(null);

  useEffect(() => {
    if (!motionAllowed() || !webglSupported()) return;
    const idle =
      "requestIdleCallback" in window
        ? (cb: () => void) => requestIdleCallback(cb, { timeout: 2000 })
        : (cb: () => void) => setTimeout(cb, 300);
    idle(() => setQuality(detectQuality()));
  }, []);

  useEffect(() => {
    if (!motionAllowed()) return;
    const root = document.querySelector<HTMLElement>("[data-shift]");
    const track = document.getElementById("night-shift");
    const morning = document.getElementById("morning");
    const triggers = [
      ScrollTrigger.create({
        start: 0,
        end: () => document.documentElement.scrollHeight - window.innerHeight,
        onUpdate: (s) => {
          shift.page = s.progress;
        },
      }),
      track &&
        ScrollTrigger.create({
          trigger: track,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (s) => {
            shift.story = s.progress;
            root?.setAttribute("data-shift", "day"); // white world — always day
          },
        }),
      morning &&
        ScrollTrigger.create({
          trigger: morning,
          start: "top bottom",
          endTrigger: document.body,
          end: "bottom bottom",
          onUpdate: (s) => {
            shift.after = s.progress;
          },
        }),
    ].filter(Boolean) as ScrollTrigger[];
    return () => triggers.forEach((t) => t.kill());
  }, []);

  return (
    <>
      <SmoothScroll />
      <Grain />
      <CursorAura />
      <DayRail />
      {quality && (
        <div className="fixed inset-0 z-0" aria-hidden>
          <World quality={quality} />
        </div>
      )}
    </>
  );
}

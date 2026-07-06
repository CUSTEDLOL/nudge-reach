"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { gsap, motionAllowed, useGSAP } from "./gsap";

/** Daylight-zone wrapper: a floating card that tilts up into view on scroll. */
export function FloatCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!motionAllowed() || !ref.current) return;
      gsap.fromTo(
        ref.current,
        { autoAlpha: 0, y: 44, rotateX: 3, transformPerspective: 900 },
        {
          autoAlpha: 1,
          y: 0,
          rotateX: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: ref.current, start: "top 84%" },
        }
      );
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={cn("v2-reveal v2-daycard overflow-hidden", className)}>
      {children}
    </div>
  );
}

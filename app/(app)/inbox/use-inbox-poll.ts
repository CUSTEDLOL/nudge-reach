"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const IDLE_LIMIT_MS = 5 * 60 * 1000;

/**
 * Inbox polling (spec §1 "real-time"): runs `tick` every `intervalMs`,
 * skips ticks while the tab is hidden, stops entirely after 5 minutes
 * without user interaction and resumes on the next interaction.
 *
 * `tick` should fetch with { cache: "no-store" } and swallow transient
 * network errors itself.
 */
export function useInboxPoll(
  tick: () => Promise<void>,
  intervalMs = 3000
): { idle: boolean } {
  const [idle, setIdle] = useState(false);
  const lastActivityRef = useRef(0);
  const tickRef = useRef(tick);
  const runningRef = useRef(false);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  useEffect(() => {
    lastActivityRef.current = Date.now();

    function markActivity() {
      lastActivityRef.current = Date.now();
      setIdle(false);
    }

    const events: (keyof DocumentEventMap)[] = [
      "pointerdown",
      "pointermove",
      "keydown",
      "visibilitychange",
    ];
    events.forEach((e) => document.addEventListener(e, markActivity));

    const timer = setInterval(async () => {
      if (document.hidden) return;
      if (Date.now() - lastActivityRef.current > IDLE_LIMIT_MS) {
        setIdle(true);
        return;
      }
      if (runningRef.current) return; // never overlap slow requests
      runningRef.current = true;
      try {
        await tickRef.current();
      } catch {
        // transient error — try again next tick
      } finally {
        runningRef.current = false;
      }
    }, intervalMs);

    return () => {
      clearInterval(timer);
      events.forEach((e) => document.removeEventListener(e, markActivity));
    };
  }, [intervalMs]);

  return { idle };
}

/**
 * The current time, re-read every `intervalMs` — the lint-clean way to use
 * Date.now() in render (quantized so the snapshot is stable within a tick).
 */
export function useNow(intervalMs = 30_000): number {
  const quantized = useSyncExternalStore(
    (onStoreChange) => {
      const timer = setInterval(onStoreChange, intervalMs);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / intervalMs),
    () => Math.floor(Date.now() / intervalMs)
  );
  return quantized * intervalMs;
}

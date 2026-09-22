/**
 * Scroll to an in-page anchor, then correct for layout shift.
 *
 * `scroll-behavior: smooth` is set globally, so the browser animates towards a
 * Y position it computes when the click happens. On the long landing page the
 * content ABOVE the target keeps settling while that animation runs — images
 * decoding, fonts swapping, scenes mounting — so the target moves and the
 * animation finishes somewhere short of it. The reported symptom is "it stops
 * in the middle of the section".
 *
 * So: start the smooth scroll, then once it has settled, snap to the real
 * position. The second call is a no-op when the first one landed correctly,
 * which is the common case on a warm page.
 */
export function scrollToHash(
  hash: string,
  opts: {
    doc?: Pick<Document, "querySelector">;
    /** Runs the correction once the smooth scroll has settled. */
    schedule?: (correct: () => void) => void;
  } = {}
): boolean {
  const doc = opts.doc ?? (typeof document !== "undefined" ? document : null);
  if (!doc) return false;

  let target: Element | null = null;
  try {
    target = doc.querySelector(hash);
  } catch {
    // A hash that isn't a valid selector (e.g. "#") — nothing to do.
    return false;
  }
  if (!target) return false;

  const el = target as HTMLElement;
  el.scrollIntoView({ behavior: "smooth", block: "start" });

  const schedule = opts.schedule ?? defaultSchedule;
  schedule(() => el.scrollIntoView({ behavior: "auto", block: "start" }));
  return true;
}

/**
 * Prefer the real `scrollend` event, which fires when the animation actually
 * finishes however long it takes. Where it isn't supported, fall back to a
 * timer long enough for a full-page smooth scroll.
 */
function defaultSchedule(correct: () => void): void {
  if (typeof window === "undefined") return;

  // `in` on the DOM lib's Window narrows to never, so probe a widened alias.
  const w = window as Window & { onscrollend?: unknown };
  if ("onscrollend" in w) {
    const onEnd = () => {
      w.removeEventListener("scrollend", onEnd);
      w.clearTimeout(safety);
      correct();
    };
    // Safety net: if the scroll is interrupted, `scrollend` may never arrive.
    const safety = w.setTimeout(onEnd, 1200);
    w.addEventListener("scrollend", onEnd, { once: true });
    return;
  }
  window.setTimeout(correct, 700);
}

/** True for the navbar's own same-page anchors, e.g. "/#compare". */
export function isSamePageHash(href: string, pathname: string): boolean {
  if (!href.startsWith("/#")) return false;
  return pathname === "/";
}

/**
 * Where to put a dropdown panel so it hangs under its trigger.
 *
 * The navbar pill sets overflow-hidden (it clips the logo slab's corners), so
 * the panel cannot be an absolutely-positioned child of the trigger — it is
 * rendered outside the pill and positioned against the trigger's measured
 * rect instead. Centring it on the trigger would push it off-screen for the
 * right-most nav item on a narrow window, so the result is clamped to the
 * viewport with a small margin.
 */
export function panelPosition(
  trigger: { left: number; width: number; bottom: number },
  viewportWidth: number,
  panelWidth: number,
  gap = 8,
  margin = 12
): { left: number; top: number } {
  const centred = trigger.left + trigger.width / 2 - panelWidth / 2;
  const maxLeft = viewportWidth - panelWidth - margin;
  // When the viewport is narrower than the panel, margin wins over maxLeft.
  const left = Math.max(margin, Math.min(centred, Math.max(margin, maxLeft)));
  return { left, top: trigger.bottom + gap };
}

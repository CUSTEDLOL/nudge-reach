import { describe, expect, it, vi } from "vitest";
import {
  isSamePageHash,
  panelPosition,
  scrollToHash,
} from "@/components/marketing/scroll-to-hash";

/**
 * The Compare link "stops in the middle" of the section. `scroll-behavior:
 * smooth` is global, so the browser animates toward a Y computed at click
 * time; on the long landing page the content above the target is still
 * settling, the target moves, and the animation ends short.
 *
 * The fix is a correction pass after the scroll settles — which must be a
 * no-op when the first landing was already right.
 */
function fakeTarget() {
  const scrollIntoView = vi.fn();
  const el = { scrollIntoView } as unknown as HTMLElement;
  return { el, scrollIntoView, doc: { querySelector: () => el } };
}

describe("scrollToHash", () => {
  it("scrolls smoothly, then re-aligns once the scroll has settled", () => {
    const { scrollIntoView, doc } = fakeTarget();
    let settle = () => {};

    const ok = scrollToHash("#compare", { doc, schedule: (fn) => (settle = fn) });

    expect(ok).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      behavior: "smooth",
      block: "start",
    });

    settle();
    // The correction must be instant — a second smooth scroll would animate
    // again and could land short for the same reason.
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: "auto",
      block: "start",
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the section is not on the page", () => {
    const schedule = vi.fn();
    const ok = scrollToHash("#nope", {
      doc: { querySelector: () => null },
      schedule,
    });
    expect(ok).toBe(false);
    expect(schedule).not.toHaveBeenCalled();
  });

  it("survives a hash that is not a valid selector", () => {
    const schedule = vi.fn();
    const doc = {
      querySelector: () => {
        throw new SyntaxError("bad selector");
      },
    };
    expect(() => scrollToHash("#", { doc, schedule })).not.toThrow();
    expect(scrollToHash("#", { doc, schedule })).toBe(false);
  });
});

describe("isSamePageHash", () => {
  it("only intercepts landing-page anchors while on the landing page", () => {
    expect(isSamePageHash("/#compare", "/")).toBe(true);
    expect(isSamePageHash("/#features", "/")).toBe(true);
    // From a sub-page the browser must navigate home first.
    expect(isSamePageHash("/#compare", "/pricing")).toBe(false);
    // Real routes are never intercepted.
    expect(isSamePageHash("/pricing", "/")).toBe(false);
    expect(isSamePageHash("/industries/clinics", "/")).toBe(false);
  });
});

/**
 * The Resources panel is rendered outside the navbar pill (the pill clips its
 * children), so it has to be positioned against the trigger's measured rect.
 * It first shipped centred on the whole navbar, which put it under the middle
 * of the bar rather than under Resources.
 */
describe("panelPosition", () => {
  const PANEL = 224; // w-56

  it("centres the panel under its trigger", () => {
    const { left, top } = panelPosition(
      { left: 600, width: 120, bottom: 70 },
      1440,
      PANEL
    );
    // trigger centre 660 → panel left 660 - 112
    expect(left).toBe(548);
    expect(top).toBe(78);
  });

  it("keeps a right-edge trigger on screen", () => {
    const { left } = panelPosition(
      { left: 1340, width: 120, bottom: 70 },
      1440,
      PANEL
    );
    expect(left).toBe(1440 - PANEL - 12);
    expect(left + PANEL).toBeLessThanOrEqual(1440);
  });

  it("keeps a left-edge trigger on screen", () => {
    const { left } = panelPosition({ left: 4, width: 80, bottom: 70 }, 1440, PANEL);
    expect(left).toBe(12);
  });

  it("does not go negative when the viewport is narrower than the panel", () => {
    const { left } = panelPosition({ left: 10, width: 60, bottom: 70 }, 200, PANEL);
    expect(left).toBeGreaterThanOrEqual(0);
  });
})

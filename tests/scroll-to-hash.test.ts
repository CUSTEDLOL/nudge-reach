import { describe, expect, it, vi } from "vitest";
import { isSamePageHash, scrollToHash } from "@/components/marketing/scroll-to-hash";

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

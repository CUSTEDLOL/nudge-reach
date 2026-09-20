"use client";

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

const noopSubscribe = () => () => {};

/** Hydration-safe "is the client mounted" flag (for portals). */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared behavior for modal/drawer overlays: Escape to close, focus trap,
 * body scroll lock, and focus restore on close.
 */
export function useOverlay(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLDivElement | null>,
  extraFocusRoot?: RefObject<HTMLElement | null>,
) {
  // Parents recreate `onClose` on every render (typing into a controlled
  // input re-renders the modal's owner). The effect must only run when the
  // overlay opens/closes — re-running it per keystroke moved focus to the
  // panel's first focusable (the close button), so the next space closed it.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    // Move focus into the panel (first focusable, else the panel itself).
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const extra = extraFocusRoot?.current;
      const focusables = [
        ...Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)),
        ...(extra?.matches(FOCUSABLE) ? [extra] : []),
        ...Array.from(extra?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
      ].filter((element, index, all) => all.indexOf(element) === index);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const active = document.activeElement;
      const currentIndex = focusables.indexOf(active as HTMLElement);
      e.preventDefault();
      if (currentIndex < 0 || active === panel) {
        (e.shiftKey ? lastEl : firstEl).focus();
        return;
      }
      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + focusables.length) % focusables.length
        : (currentIndex + 1) % focusables.length;
      focusables[nextIndex].focus();
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [open, panelRef, extraFocusRoot]);
}

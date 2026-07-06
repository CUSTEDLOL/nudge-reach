"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  value: string;
  label: ReactNode;
  count?: number;
};

/** Underline-style tab bar. Controlled (value) or uncontrolled (defaultValue). */
export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  className,
  "aria-label": ariaLabel,
}: {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.value);
  const active = value ?? internal;
  const listRef = useRef<HTMLDivElement>(null);

  function select(next: string) {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = items.findIndex((t) => t.value === active);
    const next =
      e.key === "ArrowRight"
        ? items[(idx + 1) % items.length]
        : items[(idx - 1 + items.length) % items.length];
    select(next.value);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)
      ?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        // Scrolls horizontally instead of wrapping when tabs outgrow the row.
        "no-scrollbar flex gap-4 overflow-x-auto border-b border-neutral-200 sm:gap-5",
        className
      )}
    >
      {items.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            data-value={tab.value}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => select(tab.value)}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-medium outline-none transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-brand-400/50",
              isActive
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "bg-neutral-100 text-neutral-500"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

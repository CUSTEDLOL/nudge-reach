"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

const MenuContext = createContext<{ close: () => void }>({ close: () => {} });

/**
 * Simple dropdown menu. `trigger` is rendered inside the toggle button —
 * pass content (icon/avatar/label), not another button.
 */
export function Menu({
  trigger,
  triggerLabel,
  triggerClassName,
  align = "end",
  children,
  className,
}: {
  trigger: ReactNode;
  /** Accessible name for icon-only triggers. */
  triggerLabel?: string;
  triggerClassName?: string;
  align?: "start" | "end";
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-400/50",
          triggerClassName
        )}
      >
        {trigger}
      </button>
      {open && (
        <MenuContext.Provider value={{ close: () => setOpen(false) }}>
          <div
            role="menu"
            className={cn(
              "absolute z-50 mt-2 min-w-[11rem] rounded-xl border border-black/5 bg-white p-1 shadow-lift",
              align === "end" ? "right-0" : "left-0",
              className
            )}
          >
            {children}
          </div>
        </MenuContext.Provider>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  href,
  icon,
  danger = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onSelect?: () => void;
  /** Renders a link item instead of a button. */
  href?: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  /** Use `submit` for items inside a `<form>` (e.g. sign out). */
  type?: "button" | "submit";
}) {
  const { close } = useContext(MenuContext);
  const className = cn(
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none transition-colors duration-150",
    "focus-visible:ring-2 focus-visible:ring-brand-400/50",
    danger
      ? "text-red-600 hover:bg-red-50"
      : "text-neutral-700 hover:bg-neutral-50",
    disabled && "pointer-events-none opacity-50"
  );

  if (href) {
    return (
      <Link role="menuitem" href={href} className={className} onClick={close}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button
      role="menuitem"
      type={type}
      disabled={disabled}
      className={className}
      onClick={() => {
        onSelect?.();
        if (type !== "submit") close();
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-neutral-100" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 py-1.5 text-xs font-medium text-neutral-400">
      {children}
    </div>
  );
}

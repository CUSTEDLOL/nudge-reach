"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMounted, useOverlay } from "@/components/ui/overlay";

const widths = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
} as const;

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: keyof typeof widths;
};

/** Right-side sliding panel. */
export function Drawer(props: DrawerProps) {
  const mounted = useMounted();
  if (!mounted || !props.open) return null;
  // The panel mounts fresh each time the drawer opens, so the slide-in
  // transition always starts from translate-x-full.
  return createPortal(<DrawerPanel {...props} />, document.body);
}

function DrawerPanel({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [entered, setEntered] = useState(false);

  useOverlay(open, onClose, panelRef);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className={cn(
          "absolute inset-0 bg-brand-950/40 transition-opacity duration-200",
          entered ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-lift outline-none transition-transform duration-200",
          widths[width],
          entered ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-neutral-900">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-neutral-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-lg p-1.5 text-neutral-400 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-brand-400/50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-neutral-100 p-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

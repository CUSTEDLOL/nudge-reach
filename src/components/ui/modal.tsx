"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { useMounted, useOverlay } from "@/components/ui/overlay";

// Widths only apply from sm up — below sm the panel is a full-width bottom sheet.
const sizes = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action row rendered at the bottom (usually buttons). */
  footer?: ReactNode;
  size?: keyof typeof sizes;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const mounted = useMounted();
  useOverlay(open, onClose, panelRef);

  if (!mounted || !open) return null;

  return createPortal(
    // Below sm the dialog docks to the bottom edge as a sheet; from sm up it
    // is the classic centered panel.
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-brand-950/40"
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
          "animate-rise relative flex max-h-[85dvh] w-full flex-col rounded-t-2xl border border-black/5 bg-white shadow-lift outline-none",
          "sm:max-h-[calc(100dvh-4rem)] sm:rounded-2xl",
          sizes[size]
        )}
      >
        {/* Grab handle — visual affordance for the mobile sheet only */}
        <div
          aria-hidden
          className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-neutral-200 sm:hidden"
        />
        <div className="flex shrink-0 items-start justify-between gap-4 p-5 pb-0 pt-3 sm:pt-5">
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
            aria-label="Close dialog"
            className="-m-2 rounded-lg p-2.5 text-neutral-400 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-brand-400/50 sm:-m-1 sm:p-1.5"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children && (
          <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
            {children}
          </div>
        )}
        {footer && (
          <div
            className={cn(
              "flex shrink-0 items-center justify-end gap-2 p-5 pt-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5",
              !children && "mt-4"
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  /** May be async — a pending state disables the buttons while it runs. */
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}) {
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    try {
      setPending(true);
      await onConfirm();
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

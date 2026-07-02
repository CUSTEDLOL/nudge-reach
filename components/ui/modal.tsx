"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { useMounted, useOverlay } from "@/components/ui/overlay";

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
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
          "animate-rise relative w-full rounded-2xl border border-black/5 bg-white shadow-lift outline-none",
          sizes[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-0">
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
            className="rounded-lg p-1.5 text-neutral-400 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-brand-400/50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children && <div className="p-5">{children}</div>}
        {footer && (
          <div
            className={cn(
              "flex items-center justify-end gap-2 p-5 pt-0",
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

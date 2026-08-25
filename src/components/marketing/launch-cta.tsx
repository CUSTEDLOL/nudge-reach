"use client";

import type { ReactNode } from "react";
import { BookDemoButton } from "./book-demo";
import type { ButtonSize, ButtonVariant } from "./button";

/**
 * "Book a Demo" — opens the Cal.com booking modal. No hover scene: the
 * wrapper exists so every call site keeps its props unchanged.
 */
export function LaunchDemoButton({
  children = "Book a Demo",
  variant,
  size,
  className,
  "aria-label": ariaLabel,
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  "aria-label"?: string;
  /** Accepted for call-site compatibility; the launch scene that used it is gone. */
  tone?: "light" | "dark";
}) {
  return (
    <BookDemoButton
      variant={variant}
      size={size}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </BookDemoButton>
  );
}

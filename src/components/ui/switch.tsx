"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** When set, a hidden input is rendered so the switch works in forms. */
  name?: string;
  value?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  name,
  value = "on",
  id,
  className,
  ...aria
}: SwitchProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;

  function toggle() {
    const next = !on;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={on}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full outline-none transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-brand-400/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          on ? "bg-brand-600" : "bg-neutral-200",
          className
        )}
        {...aria}
      >
        <span
          aria-hidden
          className={cn(
            "block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150",
            on ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </button>
      {name && <input type="hidden" name={name} value={on ? value : ""} />}
    </>
  );
}

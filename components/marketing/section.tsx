import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "./motion-primitives";

/** Centered max-width content wrapper. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

/** A page section with consistent vertical rhythm. */
export function Section({
  children,
  id,
  className,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("relative scroll-mt-24 py-20 sm:py-28", className)}
    >
      {children}
    </section>
  );
}

/** Small pill label that sits above a heading. */
export function Eyebrow({
  children,
  tone = "light",
  className,
}: {
  children: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold tracking-tight",
        tone === "light"
          ? "border-brand-200/70 bg-brand-50 text-brand-700"
          : "border-white/15 bg-white/5 text-brand-200",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Emerald gradient text. */
export function GradientText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("text-gradient", className)}>{children}</span>;
}

/**
 * Section header: eyebrow + title + optional subtitle, animated in.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  tone = "light",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-5",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          "max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl",
          tone === "light" ? "text-ink" : "text-white"
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "max-w-2xl text-pretty text-lg leading-relaxed",
            tone === "light" ? "text-ink/60" : "text-brand-100/70"
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </Reveal>
  );
}

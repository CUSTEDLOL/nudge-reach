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

/** A direct, left-aligned section introduction. The small green rule is the
 * shared brand cue; sections create their own composition below it. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
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
  const light = tone === "light";
  return (
    <Reveal
      className={cn(
        "flex flex-col",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      {eyebrow && (
        <div className={cn("flex items-center gap-3", align === "center" && "justify-center")}>
          <span className={cn("h-[3px] w-8", light ? "bg-brand-500" : "bg-brand-300")} />
          <span
            className={cn(
              "text-xs font-black uppercase tracking-[0.14em]",
              light ? "text-ink/60" : "text-white/60"
            )}
          >
            {eyebrow}
          </span>
        </div>
      )}
      <h2
        className={cn(
          "mt-6 max-w-4xl text-balance font-display text-4xl font-black leading-[0.98] tracking-[-0.045em] sm:text-[3.65rem]",
          light ? "text-ink" : "text-white"
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "mt-5 max-w-2xl text-pretty text-lg font-medium leading-relaxed",
            light ? "text-ink/58" : "text-white/65"
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </Reveal>
  );
}

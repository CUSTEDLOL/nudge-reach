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

/** Centered, minimal section introduction — quiet grey eyebrow, big title,
 * one measured subtitle. Sections that want the caps+serif pairing compose
 * it inside `title`. */
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
  const light = tone === "light";
  return (
    <Reveal
      className={cn(
        "flex flex-col",
        align === "center"
          ? "items-center text-center"
          : "items-start text-left",
        className
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            "text-[11.5px] font-bold uppercase tracking-[0.18em]",
            light ? "text-ink/40" : "text-white/50"
          )}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "mt-4 max-w-3xl text-balance font-display text-[2.1rem] font-black leading-[1.05] tracking-[-0.03em] sm:text-[2.9rem]",
          light ? "text-ink" : "text-white"
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "mt-5 max-w-2xl text-pretty text-[16px] leading-relaxed",
            align === "center" && "mx-auto",
            light ? "text-ink/55" : "text-white/65"
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </Reveal>
  );
}

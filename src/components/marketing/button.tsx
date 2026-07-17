import Link from "next/link";
import { type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "primary-dark"
  | "secondary-dark";

const base =
  "group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full text-[15px] font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

const sizes = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-6",
  lg: "h-[3.35rem] px-7 text-base",
} as const;

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white shadow-[0_4px_0_#047f48] hover:-translate-y-0.5 hover:bg-brand-400 hover:shadow-[0_6px_0_#047f48] active:translate-y-0 active:shadow-[0_2px_0_#047f48]",
  secondary:
    "border-2 border-ink/15 bg-white text-ink shadow-[0_4px_0_rgba(10,15,13,0.12)] hover:-translate-y-0.5 hover:border-brand-500 hover:text-brand-700 hover:shadow-[0_6px_0_rgba(6,193,103,0.35)]",
  ghost: "text-ink/70 hover:bg-black/5 hover:text-ink",
  "primary-dark":
    "bg-brand-400 text-brand-950 shadow-[0_4px_0_#047f48] hover:-translate-y-0.5 hover:bg-brand-300 hover:shadow-[0_6px_0_#047f48]",
  "secondary-dark":
    "border-2 border-white/20 bg-white/5 text-white backdrop-blur hover:bg-white/10 hover:-translate-y-0.5",
};

export type ButtonVariant = Variant;
export type ButtonSize = keyof typeof sizes;

/** The button skin without the Link — for non-navigation triggers
 * (e.g. the Cal.com Book-a-Demo modal). */
export function buttonCn(
  variant: Variant,
  size: ButtonSize = "md",
  className?: string
) {
  return cn(base, sizes[size], variants[variant], className);
}

export function ButtonLink({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
  ...props
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  size?: keyof typeof sizes;
  className?: string;
} & Omit<ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link
      href={href}
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    >
      {children}
    </Link>
  );
}

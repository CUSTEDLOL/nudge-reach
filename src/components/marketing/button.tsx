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
    "bg-brand-500 text-white shadow-[0_10px_30px_-10px_rgba(6,193,103,0.6)] hover:bg-brand-600 hover:shadow-glow hover:-translate-y-0.5 hover:scale-[1.02] before:absolute before:inset-0 before:-translate-x-[130%] before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-[130%]",
  secondary:
    "border border-black/10 bg-white text-ink shadow-soft hover:-translate-y-0.5 hover:scale-[1.02] hover:border-brand-500/40 hover:text-brand-700 hover:shadow-lift",
  ghost: "text-ink/70 hover:bg-black/5 hover:text-ink",
  "primary-dark":
    "bg-brand-400 text-brand-950 shadow-[0_10px_30px_-10px_rgba(55,206,134,0.7)] hover:bg-brand-300 hover:-translate-y-0.5",
  "secondary-dark":
    "border border-white/15 bg-white/5 text-white backdrop-blur hover:bg-white/10 hover:-translate-y-0.5",
};

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

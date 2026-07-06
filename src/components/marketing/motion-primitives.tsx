"use client";

import {
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type Variants,
} from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ *
 * useReducedMotionSafe — stays `false` during SSR and the first client
 * render so hydration matches the server HTML, then reflects the real
 * preference after mount. Diverging *during* hydration would leave the
 * server's initial styles (opacity: 0, blur) permanently in the DOM for
 * reduced-motion users, hiding the content.
 * ------------------------------------------------------------------ */
const emptySubscribe = () => () => {};

function useReducedMotionSafe() {
  const reduce = useReducedMotion();
  // false on the server and during hydration, true after — so the first
  // client render always matches the SSR output.
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  return hydrated && !!reduce;
}

/* ------------------------------------------------------------------ *
 * Reveal — fades + lifts content into view on scroll.
 * ------------------------------------------------------------------ */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 22,
  blur = true,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  blur?: boolean;
  once?: boolean;
}) {
  const reduce = useReducedMotionSafe();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: blur ? "blur(8px)" : "blur(0px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, margin: "-12% 0px -12% 0px" }}
      transition={{ duration: 0.75, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Stagger — orchestrates a cascade of <StaggerItem> children.
 * ------------------------------------------------------------------ */
const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.65, ease: EASE },
  },
};

export function Stagger({
  children,
  className,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  once?: boolean;
}) {
  const reduce = useReducedMotionSafe();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-8% 0px -8% 0px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotionSafe();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * CountUp — tweens a number from 0 once it scrolls into view.
 * ------------------------------------------------------------------ */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.7,
  className,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const reduce = useReducedMotion();
  // SSR / no-JS / reduced-motion show the real number; the count-up is an
  // enhancement layered on top for motion-friendly visitors.
  const [value, setValue] = useState(to);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (v) => setValue(v),
      onComplete: () => setValue(to),
    });
    return () => controls.stop();
  }, [inView, to, duration, reduce]);

  const formatted = value.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Marquee — seamless infinite horizontal scroller (gap-aware).
 * ------------------------------------------------------------------ */
export function Marquee({
  children,
  reverse = false,
  speed = 40,
  gap = "2rem",
  pauseOnHover = true,
  repeat = 2,
  className,
}: {
  children: ReactNode;
  reverse?: boolean;
  speed?: number;
  gap?: string;
  pauseOnHover?: boolean;
  repeat?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group flex w-full overflow-hidden mask-fade-x",
        className
      )}
      style={
        {
          "--marquee-gap": gap,
          gap,
        } as CSSProperties
      }
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          aria-hidden={i > 0}
          className={cn(
            "flex shrink-0 animate-marquee items-center",
            reverse && "[animation-direction:reverse]",
            pauseOnHover && "group-hover:[animation-play-state:paused]"
          )}
          style={{ gap, animationDuration: `${speed}s` }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * SpotlightCard — cursor-following radial highlight (CSS vars, no re-render).
 * ------------------------------------------------------------------ */
export function SpotlightCard({
  children,
  className,
  spotlight = "rgba(6,193,103,0.16)",
}: {
  children: ReactNode;
  className?: string;
  spotlight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn("group/spot relative overflow-hidden", className)}
      style={{ "--mx": "50%", "--my": "50%" } as CSSProperties}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background: `radial-gradient(420px circle at var(--mx) var(--my), ${spotlight}, transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tilt — subtle 3D tilt toward the cursor (spring-damped).
 * ------------------------------------------------------------------ */
export function Tilt({
  children,
  className,
  max = 8,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const reduce = useReducedMotionSafe();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 });
  const transform = useMotionTemplate`perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg)`;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * max * 2);
    rx.set(-py * max * 2);
  }
  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transform, transformStyle: "preserve-3d" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * MagneticButton — nudges toward the cursor on hover.
 * ------------------------------------------------------------------ */
export function Magnetic({
  children,
  className,
  strength = 0.35,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduce = useReducedMotionSafe();
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
  }
  function reset() {
    x.set(0);
    y.set(0);
  }

  if (reduce) return <div className={cn("inline-flex", className)}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x, y }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Float — gentle perpetual hover (used for hero UI cards).
 * ------------------------------------------------------------------ */
export function Float({
  children,
  className,
  delay = 0,
  amount = 14,
  duration = 7,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  amount?: number;
  duration?: number;
}) {
  const reduce = useReducedMotionSafe();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -amount, 0] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}

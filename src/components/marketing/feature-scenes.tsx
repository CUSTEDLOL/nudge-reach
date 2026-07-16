import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Stagger, StaggerItem } from "./motion-primitives";

/** Quiet-until-touched bento: five business categories on grey cards that
 * take on their pastel theme when hovered — and only then do the line
 * illustrations play (`.fs-card` gates animation-play-state in globals;
 * `.scene` stays the reduced-motion kill switch; touch devices get theme
 * + motion without hover). Animated accents use `--c1` set per card. */

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const ACCENT = "var(--c1, currentColor)";

function anim(value: string, extra?: CSSProperties): CSSProperties {
  return { animation: value, ...extra };
}

/** Rotation/sweep around a fixed point in viewBox coordinates. */
function pivot(x: number, y: number, animation: string): CSSProperties {
  return {
    transformBox: "view-box",
    transformOrigin: `${x}px ${y}px`,
    animation,
  };
}

/* ---------------------------------------------------------------- *
 * Clinics — reminder clock + live calendar with slots filling in
 * (white panels on the solid green flagship card)
 * ---------------------------------------------------------------- */

function ReminderClock() {
  const hourAngle = (8 * Math.PI) / 6; // 8 o'clock — the evening reminder
  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="rounded-2xl bg-white px-6 py-5 shadow-[0_12px_26px_-16px_rgba(10,31,26,0.22)] ring-1 ring-black/[0.04]">
        <svg
          viewBox="0 0 130 130"
          className="h-[104px] w-[104px] text-ink"
          fill="none"
          aria-hidden
        >
          <circle
            cx="65"
            cy="65"
            r="58"
            stroke="currentColor"
            strokeOpacity=".08"
            strokeDasharray="2 5"
          />
          <circle
            cx="65"
            cy="65"
            r="50"
            stroke="currentColor"
            strokeOpacity=".16"
            strokeWidth="1.5"
          />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <line
                key={i}
                x1={65 + Math.sin(a) * 44}
                y1={65 - Math.cos(a) * 44}
                x2={65 + Math.sin(a) * 50}
                y2={65 - Math.cos(a) * 50}
                stroke="currentColor"
                strokeOpacity=".22"
                strokeWidth="1.5"
              />
            );
          })}
          {/* hour hand fixed on the evening; minute hand sweeps */}
          <line
            x1="65"
            y1="65"
            x2={65 + Math.sin(hourAngle) * 24}
            y2={65 - Math.cos(hourAngle) * 24}
            stroke="currentColor"
            strokeOpacity=".45"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <g style={pivot(65, 65, "scene-spin 12s linear infinite")}>
            <line
              x1="65"
              y1="65"
              x2="65"
              y2="29"
              style={{ stroke: ACCENT }}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
          <circle cx="65" cy="65" r="3.5" style={{ fill: ACCENT }} />
        </svg>
      </div>
      <figcaption className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] opacity-80">
        Reminder · evening before
      </figcaption>
    </figure>
  );
}

const BOOKED_SLOTS = [3, 9, 16];

function BookingCalendar() {
  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="rounded-2xl bg-white px-5 py-5 shadow-[0_12px_26px_-16px_rgba(10,31,26,0.22)] ring-1 ring-black/[0.04]">
        <svg
          viewBox="0 0 210 124"
          className="h-[104px] w-[176px] text-ink"
          fill="none"
          aria-hidden
        >
          <rect
            x="6"
            y="4"
            width="198"
            height="116"
            rx="12"
            stroke="currentColor"
            strokeOpacity=".16"
            strokeWidth="1.5"
          />
          <line
            x1="6"
            y1="32"
            x2="204"
            y2="32"
            stroke="currentColor"
            strokeOpacity=".1"
          />
          <circle cx="23" cy="18" r="3.5" style={{ fill: ACCENT }} />
          <rect
            x="34"
            y="14.5"
            width="44"
            height="7"
            rx="3.5"
            fill="currentColor"
            fillOpacity=".12"
          />
          {Array.from({ length: 21 }).map((_, i) => {
            const booked = BOOKED_SLOTS.indexOf(i);
            return (
              <rect
                key={i}
                x={19 + (i % 7) * 25.5}
                y={42 + Math.floor(i / 7) * 24}
                width="18"
                height="16"
                rx="4"
                fill={booked >= 0 ? undefined : "currentColor"}
                opacity={booked >= 0 ? 0.55 : 0.07}
                style={
                  booked >= 0
                    ? anim(`scene-blink 6.6s ease-in-out infinite`, {
                        animationDelay: `${booked * 2.2}s`,
                        fill: ACCENT,
                      })
                    : undefined
                }
              />
            );
          })}
        </svg>
      </div>
      <figcaption className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] opacity-80">
        Live calendar · slot held
      </figcaption>
    </figure>
  );
}

/* ---------------------------------------------------------------- *
 * Real estate — key floating inside slowly precessing orbits
 * (white line art straight on the solid card)
 * ---------------------------------------------------------------- */

function KeyOrbit() {
  return (
    <svg
      viewBox="0 0 230 176"
      className="h-[160px] w-full max-w-[250px]"
      fill="none"
      aria-hidden
    >
      <g style={pivot(115, 90, "scene-spin 38s linear infinite")}>
        <g transform="rotate(-16 115 90)">
          <ellipse
            cx="115"
            cy="90"
            rx="100"
            ry="34"
            stroke="currentColor"
            strokeOpacity=".35"
            strokeDasharray="3 6"
          />
          <circle cx="211" cy="112" r="4" style={{ fill: ACCENT }} fillOpacity=".9" />
          <circle cx="21" cy="76" r="4" style={{ fill: ACCENT }} fillOpacity=".9" />
        </g>
      </g>
      <g style={pivot(115, 90, "scene-spin 26s linear infinite reverse")}>
        <g transform="rotate(14 115 90)">
          <ellipse
            cx="115"
            cy="90"
            rx="80"
            ry="25"
            stroke="currentColor"
            strokeOpacity=".3"
            strokeDasharray="2 5"
          />
          <circle cx="195" cy="90" r="3" style={{ fill: ACCENT }} fillOpacity=".8" />
        </g>
      </g>
      <g style={anim("scene-float 7s ease-in-out infinite")}>
        <g
          transform="rotate(-34 115 90)"
          style={{ stroke: ACCENT }}
          strokeLinecap="round"
        >
          <circle cx="76" cy="90" r="19" strokeWidth="7" />
          <line x1="95" y1="90" x2="164" y2="90" strokeWidth="8" />
          <line x1="141" y1="90" x2="141" y2="106" strokeWidth="6" />
          <line x1="157" y1="90" x2="157" y2="109" strokeWidth="6" />
        </g>
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------- *
 * Restaurants — floor plan, tables filling one by one
 * ---------------------------------------------------------------- */

const TABLES = [
  { x: 48, y: 40 },
  { x: 118, y: 32 },
  { x: 186, y: 44 },
  { x: 62, y: 100 },
  { x: 134, y: 94 },
  { x: 198, y: 104 },
];

function TableFloor() {
  return (
    <svg
      viewBox="0 0 234 136"
      className="h-[130px] w-full max-w-[240px]"
      fill="none"
      aria-hidden
    >
      {TABLES.map(({ x, y }, i) => (
        <g key={i}>
          {/* chairs */}
          <rect x={x - 5} y={y - 25} width="10" height="6" rx="2" fill="currentColor" fillOpacity=".4" />
          <rect x={x - 5} y={y + 19} width="10" height="6" rx="2" fill="currentColor" fillOpacity=".4" />
          <rect x={x - 25} y={y - 5} width="6" height="10" rx="2" fill="currentColor" fillOpacity=".4" />
          <rect x={x + 19} y={y - 5} width="6" height="10" rx="2" fill="currentColor" fillOpacity=".4" />
          {/* table + seated state */}
          <circle cx={x} cy={y} r="14" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.5" />
          <circle
            cx={x}
            cy={y}
            r="9"
            opacity=".5"
            style={anim("scene-blink 7.2s ease-in-out infinite", {
              animationDelay: `${i * 1.2}s`,
              fill: ACCENT,
            })}
          />
        </g>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------- *
 * Ecommerce — payment card, check draws in, PAID chip lands
 * (ink line art on the solid yellow card)
 * ---------------------------------------------------------------- */

function PaidCard() {
  return (
    <svg
      viewBox="0 0 210 144"
      className="h-[138px] w-full max-w-[220px]"
      fill="none"
      aria-hidden
    >
      <rect
        x="28"
        y="18"
        width="128"
        height="84"
        rx="12"
        stroke="currentColor"
        strokeOpacity=".45"
        strokeWidth="1.5"
      />
      <rect x="42" y="34" width="32" height="22" rx="4" fill="currentColor" fillOpacity=".3" />
      <rect x="42" y="70" width="72" height="7" rx="3.5" fill="currentColor" fillOpacity=".35" />
      <rect x="42" y="83" width="46" height="7" rx="3.5" fill="currentColor" fillOpacity=".25" />
      <circle
        cx="158"
        cy="94"
        r="26"
        fill="#ffffff"
        stroke="currentColor"
        strokeOpacity=".45"
        strokeWidth="1.5"
      />
      <path
        d="M146 94l8 8 17-17"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="36"
        style={anim("scene-draw 5.6s ease-in-out infinite", {
          "--len": "36",
          stroke: ACCENT,
        } as CSSProperties)}
      />
      <g style={anim("scene-pop 5.6s ease-in-out infinite")}>
        <rect
          x="46"
          y="114"
          width="56"
          height="20"
          rx="10"
          style={{ fill: ACCENT }}
          fillOpacity=".18"
        />
        <text
          x="74"
          y="127.5"
          textAnchor="middle"
          fontSize="9"
          fontFamily={MONO}
          letterSpacing="2"
          style={{ fill: ACCENT }}
        >
          PAID
        </text>
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------- *
 * Education — reply-time gauge sweeping from hours to seconds
 * ---------------------------------------------------------------- */

function ReplyGauge() {
  const cx = 105;
  const cy = 112;
  return (
    <svg
      viewBox="0 0 210 130"
      className="h-[126px] w-full max-w-[220px]"
      fill="none"
      aria-hidden
    >
      <path
        d={`M ${cx - 82} ${cy} A 82 82 0 0 1 ${cx + 82} ${cy}`}
        stroke="currentColor"
        strokeOpacity=".3"
        strokeWidth="1.5"
      />
      {Array.from({ length: 25 }).map((_, i) => {
        const a = Math.PI + (i * Math.PI) / 24;
        const major = i % 6 === 0;
        const r1 = major ? 64 : 68;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * r1}
            y1={cy + Math.sin(a) * r1}
            x2={cx + Math.cos(a) * 74}
            y2={cy + Math.sin(a) * 74}
            stroke="currentColor"
            strokeOpacity={major ? ".7" : ".4"}
            strokeWidth={major ? "2" : "1.5"}
          />
        );
      })}
      <text
        x={cx - 82}
        y={cy + 14}
        fontSize="8.5"
        fontFamily={MONO}
        letterSpacing="1"
        fill="currentColor"
        fillOpacity=".6"
      >
        HOURS
      </text>
      <text
        x={cx + 82}
        y={cy + 14}
        textAnchor="end"
        fontSize="8.5"
        fontFamily={MONO}
        letterSpacing="1"
        style={{ fill: ACCENT }}
        fillOpacity=".95"
      >
        SECONDS
      </text>
      <g style={pivot(cx, cy, "scene-sweep 6.5s ease-in-out infinite")}>
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy - 58}
          style={{ stroke: ACCENT }}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <circle cx={cx} cy={cy} r="4.5" style={{ fill: ACCENT }} fillOpacity=".95" />
    </svg>
  );
}

/* ---------------------------------------------------------------- *
 * The bento
 * ---------------------------------------------------------------- */

type Scene = {
  eyebrow: string;
  title: string;
  body: string;
  art: ReactNode;
  /** Solid card colour (6-digit hex). */
  color: string;
  /** Accent (`--c1`) the illustration's animated parts use. */
  accent: string;
  /** Ink text instead of white — for light card colours. */
  ink?: boolean;
  wide?: boolean;
};

const SCENES: Scene[] = [
  {
    eyebrow: "Real estate",
    title: "Chases every lead.",
    body: "Until the site visit lands.",
    color: "#e3f4ea",
    accent: "#06c167",
    ink: true,
    art: (
      <div className="flex w-full flex-wrap items-end justify-center gap-x-10 gap-y-6">
        <figure className="flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-white px-5 py-4 text-ink shadow-[0_12px_26px_-16px_rgba(10,31,26,0.22)] ring-1 ring-black/[0.04]">
            <KeyOrbit />
          </div>
          <figcaption className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] opacity-80">
            Lead chased · replied
          </figcaption>
        </figure>
        <BookingCalendar />
      </div>
    ),
    wide: true,
  },
  {
    eyebrow: "Schools & institutions",
    title: "Replies in seconds.",
    body: "Before the next place does.",
    color: "#f0ecfb",
    accent: "#8b5cf6",
    ink: true,
    art: <ReplyGauge />,
  },
  {
    eyebrow: "Dental, clinics & hospitals",
    title: "Cuts the no-shows.",
    body: "A reminder the evening before.",
    color: "#e6f3fb",
    accent: "#0ea5e9",
    ink: true,
    art: <ReminderClock />,
  },
  {
    eyebrow: "Restaurants & cafés",
    title: "Fills every table.",
    body: "Even at full tilt.",
    color: "#fdeee1",
    accent: "#f97316",
    ink: true,
    art: <TableFloor />,
  },
  {
    eyebrow: "Salons",
    title: "Takes the deposit.",
    body: "Locks the chair, cuts no-shows.",
    color: "#fbf3d9",
    accent: "#ca8a04",
    ink: true,
    art: <PaidCard />,
  },
];

export function FeatureScenes() {
  return (
    <Stagger className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {SCENES.map(({ eyebrow, title, body, art, color, accent, ink, wide }) => (
        <StaggerItem
          key={eyebrow}
          className={cn("h-full", wide && "md:col-span-2")}
        >
          <div
            className={cn(
              "scene fs-card flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.05] bg-[#f5f5f7] p-7 shadow-[0_16px_36px_-26px_rgba(10,31,26,0.2)] transition-all duration-500 ease-out hover:-translate-y-0.5 hover:bg-[var(--card)] hover:shadow-[0_26px_50px_-28px_rgba(10,31,26,0.25)] sm:p-8 [@media(hover:none)]:bg-[var(--card)]",
              ink ? "text-[#07261c]" : "text-white"
            )}
            style={{ "--card": color, "--c1": accent } as CSSProperties}
          >
            <span
              className={cn(
                "self-start rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]",
                ink ? "bg-[#07261c]/10" : "bg-white/20"
              )}
            >
              {eyebrow}
            </span>
            <h3 className="serif-display mt-4 text-[1.4rem] leading-snug sm:text-[1.55rem]">
              {title}
            </h3>
            <p
              className={cn(
                "mt-2.5 max-w-md text-[13.5px] leading-relaxed",
                ink ? "text-[#07261c]/75" : "text-white/85"
              )}
            >
              {body}
            </p>
            <div className="mt-8 flex flex-1 items-end justify-center">
              {art}
            </div>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

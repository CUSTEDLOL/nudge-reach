import Image from "next/image";
import { cn } from "@/lib/cn";

type Feature = {
  label: string;
  headline: string;
  body: string;
  img: string;
  background: string;
  accent: string;
  backdropWord: string;
  mediaClassName: string;
  imageClassName: string;
  imagePosition: string;
  wide?: boolean;
};

const FEATURES: Feature[] = [
  {
    label: "Personalized AI Agent",
    headline: "Every conversation feels personal.",
    body: "An intelligent WhatsApp agent that remembers preferences, responds instantly and follows up automatically.",
    img: "/features/ai-agent.webp",
    background:
      "linear-gradient(135deg, #54e58b 0%, #8eec72 48%, #c9f34f 100%)",
    accent: "#075c35",
    backdropWord: "THINKS",
    mediaClassName: "mt-1 lg:mt-0 lg:min-h-[25rem]",
    imageClassName: "scale-[1.03] lg:scale-[1.08] lg:-translate-y-2",
    imagePosition: "object-center",
    wide: true,
  },
  {
    label: "Broadcast Marketing",
    headline: "Reach every customer at once.",
    body: "Create targeted WhatsApp campaigns, segment audiences and track delivery and engagement.",
    img: "/features/broadcast.webp",
    background:
      "linear-gradient(145deg, #ff7b5b 0%, #ff9f55 48%, #ffd34e 100%)",
    accent: "#7a240e",
    backdropWord: "REACH",
    mediaClassName: "mt-3 min-h-[17rem]",
    imageClassName: "scale-[1.05]",
    imagePosition: "object-top",
  },
  {
    label: "Real-Time Analytics",
    headline: "See what is happening right now.",
    body: "Track conversations, response times, leads, conversions and revenue as they change.",
    img: "/features/analytics.webp",
    background:
      "linear-gradient(145deg, #3299ff 0%, #51c9f3 50%, #63e3dc 100%)",
    accent: "#073d72",
    backdropWord: "KNOW",
    mediaClassName: "mt-1 min-h-[18rem]",
    imageClassName: "scale-[1.03] -translate-y-2",
    imagePosition: "object-top",
  },
  {
    label: "Integrations",
    headline: "Connect the tools you already use.",
    body: "Sync Nudge with calendars, payment systems, CRMs, spreadsheets and commerce platforms.",
    img: "/features/integrations.webp",
    background:
      "linear-gradient(145deg, #866cff 0%, #b477f1 48%, #ef79cc 100%)",
    accent: "#35206f",
    backdropWord: "SYNC",
    mediaClassName: "mt-2 min-h-[17rem]",
    imageClassName: "scale-[0.98]",
    imagePosition: "object-top",
  },
  {
    label: "Green Tick Verification",
    headline: "Turn trust into more conversations.",
    body: "Get guidance for WhatsApp business verification and strengthen customer confidence.",
    img: "/features/green-tick.webp",
    background:
      "linear-gradient(145deg, #00b967 0%, #27d674 48%, #87ed7d 100%)",
    accent: "#064b2d",
    backdropWord: "TRUST",
    mediaClassName: "mt-5 min-h-[15rem]",
    imageClassName: "scale-[1.18] translate-y-5",
    imagePosition: "object-bottom",
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <article
      className={cn(
        "relative flex min-h-[29rem] h-full flex-col overflow-hidden rounded-[1.75rem] border-2 border-ink/70 p-6 shadow-[9px_9px_0_rgba(10,15,13,0.82)] sm:p-7",
        feature.wide && "md:col-span-2 lg:flex-row lg:gap-8"
      )}
      style={{ background: feature.background }}
    >
      <div
        aria-hidden
        className={cn(
          "absolute select-none whitespace-nowrap font-display font-black uppercase leading-none tracking-[-0.08em] text-white/20",
          feature.wide
            ? "-bottom-5 -left-2 text-[clamp(5rem,12vw,10rem)]"
            : "-bottom-3 -right-1 text-[clamp(4.5rem,8vw,7.5rem)]"
        )}
      >
        {feature.backdropWord}
      </div>
      <div
        aria-hidden
        className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full border-[38px] border-white/15"
      />

      <div
        className={cn(
          "relative z-10 shrink-0",
          feature.wide && "lg:w-[42%]"
        )}
      >
        <h3 className="max-w-xl font-display text-[clamp(1.65rem,3.1vw,2.8rem)] font-black uppercase leading-[0.94] tracking-[-0.045em] text-ink">
          {feature.label}
        </h3>
        <p
          className="mt-4 font-display text-[16px] font-black leading-tight sm:text-[18px]"
          style={{ color: feature.accent }}
        >
          {feature.headline}
        </p>
        <p className="mt-2 max-w-md text-[13px] font-medium leading-relaxed text-ink/75 sm:text-[14px]">
          {feature.body}
        </p>
      </div>

      <div
        className={cn(
          "relative z-10 min-h-0 flex-1",
          feature.mediaClassName
        )}
      >
        <div
          aria-hidden
          className="absolute bottom-[-18%] left-1/2 h-[90%] w-[90%] -translate-x-1/2 rounded-full bg-white/24 blur-3xl"
        />
        <Image
          src={feature.img}
          alt={`${feature.label} product screen`}
          fill
          sizes={
            feature.wide
              ? "(max-width: 768px) 100vw, 66vw"
              : "(max-width: 768px) 100vw, 33vw"
          }
          className={cn(
            "object-contain",
            feature.imagePosition,
            feature.imageClassName
          )}
          style={{
            filter:
              "saturate(1.16) contrast(1.04) drop-shadow(0 18px 24px rgba(10,31,26,0.22))",
          }}
        />
      </div>
    </article>
  );
}

export function FeatureScenes() {
  return (
    <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature) => (
        <FeatureCard key={feature.label} feature={feature} />
      ))}
    </div>
  );
}

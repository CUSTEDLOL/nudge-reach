import { ArrowRight } from "lucide-react";
import { GetAccessButton } from "@/components/marketing/get-access";

/**
 * The closer — the page ends back in the hero's day scene: same sky, same
 * serif voice, one ask. The still is the poster/fallback like the hero.
 */
export function FinalCtaV2() {
  return (
    <section
      id="get-access"
      className="relative overflow-hidden bg-[#7fb2e8]"
      aria-label="Get early access to Nudge"
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/hero/finale.jpg"
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-top"
      >
        <source src="/hero/finale.mp4" type="video/mp4" />
      </video>
      {/* legibility grade over the scene */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#09284a]/35 via-[#09284a]/10 to-[#09284a]/45"
      />
      <div className="relative mx-auto flex min-h-[68svh] w-full max-w-[110rem] flex-col items-center justify-center px-5 py-24 text-center sm:px-6">
        <h2
          className="serif-display max-w-3xl text-[clamp(2rem,4.5vw,4rem)] leading-[1.1] tracking-[-0.015em] text-white"
          style={{
            textShadow:
              "0 2px 10px rgba(9,40,74,0.55), 0 10px 44px rgba(9,40,74,0.45)",
          }}
        >
          Your front desk clocks in tonight.
        </h2>
        <p
          className="mt-4 max-w-xl text-[16.5px] leading-relaxed text-white/90"
          style={{ textShadow: "0 1px 8px rgba(9,40,74,0.5)" }}
        >
          Books real appointments, chases quiet leads, collects payments — and
          we set the whole thing up for you.
        </p>
        <GetAccessButton
          source="final-cta"
          className="group/link mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[16px] font-semibold text-ink shadow-[0_16px_40px_-14px_rgba(7,38,28,0.6)] transition-all hover:-translate-y-0.5 hover:bg-white/90"
        >
          Get Early Access
          <ArrowRight
            className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-0.5"
            aria-hidden
          />
        </GetAccessButton>
      </div>
    </section>
  );
}

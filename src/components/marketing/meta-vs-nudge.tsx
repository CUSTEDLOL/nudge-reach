import { Crown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Container, Section } from "./section";
import { BookDemoButton } from "./book-demo";

/**
 * The scorecard: the capability ledger rebuilt as a game roster. Every
 * contender is a player card — five stats, chunky power bars, a giant ghost
 * score — ranked into a leaderboard with Nudge as the champion card. Scores
 * are the old ledger's marks translated to 0–3 (none / you-wire-it /
 * partial / does it), so the fun framing sits on honest data. Static: the
 * only motion is a hover lift, so nothing here can misbehave.
 */

const STATS = ["Answers", "Books", "Chases", "Collects", "Runs itself"] as const;

type Player = {
  name: string;
  klass: string;
  /** 0 = doesn't, 1 = only if you wire it, 2 = partial, 3 = does it. */
  scores: [number, number, number, number, number];
  verdict: string;
  card: string;
  accent: string;
  ink?: "light";
};

const ROSTER: Player[] = [
  {
    name: "Nudge",
    klass: "AI Front Desk",
    scores: [3, 3, 3, 3, 3],
    verdict:
      "Trained on your business, takes the real actions, chases the revenue — and we set the whole thing up.",
    card: "linear-gradient(135deg, #54e58b 0%, #8eec72 48%, #c9f34f 100%)",
    accent: "#075c35",
  },
  {
    name: "Haptik",
    klass: "Enterprise",
    scores: [3, 2, 2, 2, 2],
    verdict: "Can do it all — with enterprise scope, timelines and price tag.",
    card: "linear-gradient(145deg, #8ba4ff 0%, #a99bf5 100%)",
    accent: "#2c2f7a",
  },
  {
    name: "A hire",
    klass: "Human desk",
    scores: [2, 3, 1, 3, 1],
    verdict: "Does the job properly — for nine hours, then goes home.",
    card: "linear-gradient(145deg, #ffb37a 0%, #ffd06a 100%)",
    accent: "#7a3d0e",
  },
  {
    name: "AiSensy",
    klass: "CRM tool",
    scores: [3, 1, 1, 1, 0],
    verdict: "Good software. You are still the one operating it.",
    card: "linear-gradient(145deg, #9fd8f0 0%, #b8e6e0 100%)",
    accent: "#0d5170",
  },
  {
    name: "WATI",
    klass: "CRM tool",
    scores: [3, 1, 1, 1, 0],
    verdict: "Broad platform, deep settings — all driven by your team.",
    card: "linear-gradient(145deg, #9fd8f0 0%, #b8e6e0 100%)",
    accent: "#0d5170",
  },
  {
    name: "Interakt",
    klass: "CRM tool",
    scores: [3, 1, 1, 1, 0],
    verdict: "Commerce and messaging tools, pointed by a human.",
    card: "linear-gradient(145deg, #9fd8f0 0%, #b8e6e0 100%)",
    accent: "#0d5170",
  },
  {
    name: "Meta AI",
    klass: "Free",
    scores: [3, 0, 0, 0, 1],
    verdict: "Answers beautifully. Then the conversation just sits there.",
    card: "linear-gradient(145deg, #d7dbe2 0%, #e8ebef 100%)",
    accent: "#3b4450",
  },
];

const MAX = STATS.length * 3;
const total = (p: Player) => p.scores.reduce((a, b) => a + b, 0);

function PowerBar({ value, accent }: { value: number; accent: string }) {
  return (
    <span className="flex gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-4 rounded-[2px] border border-ink/25 sm:w-5"
          style={{ background: i < value ? accent : "transparent" }}
        />
      ))}
    </span>
  );
}

function StatSheet({ player }: { player: Player }) {
  return (
    <dl className="space-y-1.5">
      {STATS.map((stat, i) => (
        <div key={stat} className="flex items-center justify-between gap-3">
          <dt className="font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink/60">
            {stat}
          </dt>
          <dd
            className="shrink-0"
            aria-label={`${stat}: ${player.scores[i]} out of 3`}
          >
            <PowerBar value={player.scores[i]} accent={player.accent} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function GhostScore({ value, wide }: { value: number; wide?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute select-none font-display font-black leading-none tracking-[-0.06em] text-white/25",
        wide
          ? "-bottom-6 right-4 text-[clamp(6rem,13vw,11rem)]"
          : "-bottom-4 right-2 text-[clamp(3.5rem,7vw,5.5rem)]"
      )}
    >
      {value}
    </span>
  );
}

export function MetaVsNudge() {
  const champion = ROSTER[0];
  const rest = ROSTER.slice(1);

  return (
    <Section id="compare" className="overflow-x-clip bg-[#f1f7ec]">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block -rotate-2 rounded-full border-2 border-ink/70 bg-white px-4 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.82)]">
            Biased scorecard · honest data
          </span>
          <h2 className="mt-6 font-display text-[2rem] font-black uppercase leading-[0.96] tracking-[-0.035em] text-ink sm:text-[3.2rem]">
            We scored the
            <br />
            whole roster.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink/60">
            Five things a front desk actually does. Everyone answers now —
            that&rsquo;s one stat out of five. Here&rsquo;s the rest of the
            sheet.
          </p>
        </div>

        {/* champion */}
        <article
          className="relative mx-auto mt-12 flex max-w-6xl flex-col gap-6 overflow-hidden rounded-[1.75rem] border-2 border-ink/70 p-6 shadow-[9px_9px_0_rgba(10,15,13,0.82)] sm:p-8 lg:flex-row lg:items-center lg:gap-10"
          style={{ background: champion.card }}
        >
          <GhostScore value={total(champion)} wide />

          <div className="relative z-10 lg:w-[46%]">
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/70 bg-white px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-ink">
              <Crown className="h-3.5 w-3.5" aria-hidden />
              Rank 01
            </span>
            <h3 className="mt-3 font-display text-[clamp(2.2rem,5vw,3.4rem)] font-black uppercase leading-[0.9] tracking-[-0.045em] text-ink">
              {champion.name}
            </h3>
            <p
              className="mt-1 font-display text-[15px] font-black uppercase tracking-[0.02em]"
              style={{ color: champion.accent }}
            >
              {champion.klass}
            </p>
            <p className="mt-4 max-w-md text-[14px] font-medium leading-relaxed text-ink/75">
              {champion.verdict}
            </p>
          </div>

          <div className="relative z-10 flex-1 rounded-2xl border-2 border-ink/25 bg-white/55 p-5 backdrop-blur-sm sm:p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/55">
                Stat sheet
              </span>
              <span className="font-display text-[15px] font-black text-ink">
                {total(champion)}
                <span className="text-ink/45">/{MAX}</span>
              </span>
            </div>
            <StatSheet player={champion} />
          </div>
        </article>

        {/* the rest of the roster */}
        <div className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((player, index) => (
            <article
              key={player.name}
              className="relative flex flex-col overflow-hidden rounded-[1.5rem] border-2 border-ink/70 p-5 shadow-[7px_7px_0_rgba(10,15,13,0.82)] transition-transform duration-300 hover:-translate-y-1 sm:p-6"
              style={{ background: player.card }}
            >
              <GhostScore value={total(player)} />

              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-[1.4rem] font-black uppercase leading-none tracking-[-0.035em] text-ink sm:text-[1.55rem]">
                    {player.name}
                  </h3>
                  <p
                    className="mt-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: player.accent }}
                  >
                    {player.klass}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border-2 border-ink/70 bg-white px-2 py-0.5 font-mono text-[9.5px] font-black text-ink">
                  {String(index + 2).padStart(2, "0")}
                </span>
              </div>

              <div className="relative z-10 mt-5 rounded-xl border-2 border-ink/20 bg-white/55 p-3.5">
                <StatSheet player={player} />
              </div>

              <p className="relative z-10 mt-4 text-[12.5px] font-medium leading-snug text-ink/70">
                {player.verdict}
              </p>

              <p className="relative z-10 mt-3 font-display text-[13px] font-black text-ink/80">
                {total(player)}
                <span className="text-ink/40">/{MAX}</span>
              </p>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[13px] leading-relaxed text-ink/50">
          Scored on what each one does without you: full bar = does it, half =
          only once you wire it up, empty = it doesn&rsquo;t. We built this, so
          of course we win our own scorecard — the stats underneath are the
          honest part.
        </p>

        <div className="mt-8 flex justify-center">
          <BookDemoButton variant="primary">
            Book a Demo — see it run yours
          </BookDemoButton>
        </div>
      </Container>
    </Section>
  );
}

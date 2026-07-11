import { CountUp } from "../../motion-primitives";

const STATS: { to: number; prefix?: string; label: string }[] = [
  { to: 6, label: "appointments booked" },
  { to: 11, label: "quiet leads chased" },
  { to: 4300, prefix: "₹", label: "collected in deposits" },
  { to: 0, label: "messages missed" },
];

/** 9:00 AM — the payoff. What the owner walks into after one shift.
 *  Editorial cut: ruled header line, asymmetric copy block, stats as a
 *  ledger row with hairline rules — no centered template symmetry. */
export function Morning() {
  return (
    <section
      id="morning"
      className="relative px-4 py-28 sm:px-6"
      aria-label="The morning after"
    >
      <div className="v2-daycard px-6 py-14 sm:px-12 sm:py-16">
        <div className="flex items-baseline gap-4 border-b border-ink/10 pb-4">
          <span className="font-mono text-sm font-semibold text-brand-600">
            9:00 AM
          </span>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/45">
            you just walked in
          </p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <h2 className="font-display text-[clamp(2.6rem,6vw,4.6rem)] font-bold leading-[0.98] tracking-[-0.035em] text-ink">
            You slept.
            <br />
            <span className="text-brand-600">It didn&rsquo;t.</span>
          </h2>
          <p className="max-w-sm text-lg leading-relaxed text-ink/60 lg:pb-2">
            One night like this, every night. Here&rsquo;s what a shift hands
            you at open:
          </p>
        </div>

        <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={s.label} className="border-t border-ink/15 pt-4">
              <div className="flex items-baseline justify-between">
                <dd className="font-display text-5xl font-bold tracking-[-0.03em] text-ink sm:text-6xl">
                  <CountUp to={s.to} prefix={s.prefix ?? ""} />
                </dd>
                <span className="font-mono text-[11px] text-ink/30">
                  0{i + 1}
                </span>
              </div>
              <dt className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
        <p className="mt-12 text-xs text-ink/35">
          Illustrative shift for a two-chair clinic on the AI Front Desk plan.
        </p>
      </div>
    </section>
  );
}

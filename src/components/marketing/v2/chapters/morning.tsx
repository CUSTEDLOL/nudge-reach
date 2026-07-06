import { CountUp } from "../../motion-primitives";

const STATS: { to: number; prefix?: string; label: string }[] = [
  { to: 6, label: "appointments booked" },
  { to: 11, label: "quiet leads chased" },
  { to: 4300, prefix: "₹", label: "collected in deposits" },
  { to: 0, label: "messages missed" },
];

/** 9:00 AM — the payoff. What the owner walks into after one shift. */
export function Morning() {
  return (
    <section
      id="morning"
      className="relative px-4 py-28 sm:px-6"
      aria-label="The morning after"
    >
      <div className="v2-daycard px-6 py-16 text-center sm:px-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-700">
          9:00 AM — you just walked in
        </p>
        <h2 className="mt-5 font-display text-[clamp(2.6rem,6vw,4.8rem)] leading-[1.02] text-ink">
          You slept. <span className="italic text-brand-600">It didn&rsquo;t.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink/60">
          One night like this, every night. Here&rsquo;s what a shift hands you
          at open:
        </p>
        <dl className="mt-12 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <dd className="font-display text-5xl text-ink">
                <CountUp to={s.to} prefix={s.prefix ?? ""} />
              </dd>
              <dt className="mt-2 text-sm text-ink/55">{s.label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-xs text-ink/35">
          Illustrative shift for a two-chair clinic on the AI Front Desk plan.
        </p>
      </div>
    </section>
  );
}

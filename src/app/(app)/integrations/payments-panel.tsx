import { Check, Info } from "lucide-react";

/**
 * Payments are configured by Nudge, not by the client, so this panel explains
 * what the AI can already do rather than offering a connect button that would
 * do nothing.
 */
export function PaymentsPanel({
  live,
  currency,
}: {
  live: boolean;
  currency: string;
}) {
  const rail = currency === "INR" ? "Razorpay (UPI and cards)" : "Stripe (cards)";
  return (
    <div className="flex flex-col gap-5">
      <div
        className={
          live
            ? "flex items-start gap-3 rounded-xl bg-brand-50 px-4 py-3"
            : "flex items-start gap-3 rounded-xl bg-sky-50 px-4 py-3"
        }
      >
        {live ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden />
        )}
        <p
          className={
            live
              ? "text-sm leading-relaxed text-brand-900"
              : "text-sm leading-relaxed text-sky-900"
          }
        >
          {live
            ? `Live. Deposits are collected through ${rail} and land in your account.`
            : `Payment links work end to end in this test workspace. Real money starts flowing through ${rail} once we switch your workspace live — nothing for you to install.`}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900">
          What the AI does with it
        </h3>
        <ul className="mt-3 flex flex-col gap-2.5">
          {[
            "Sends a deposit link in the chat when it books an appointment.",
            "Chases the customer if the link goes unpaid.",
            "Marks the booking paid and tells your team, without anyone checking.",
          ].map((line) => (
            <li key={line} className="flex gap-2.5 text-sm text-neutral-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm leading-relaxed text-neutral-500">
        Nudge does not take a cut of your payments. Your payment provider&apos;s
        own transaction fee is the only charge.
      </p>
    </div>
  );
}

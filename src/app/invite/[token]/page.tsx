import Link from "next/link";
import { Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { OwnerSetupForm } from "@/components/features/owner-setup-form";
import { findValidOwnerSetupInvite } from "@/modules/orgs/owner-setup";

export const metadata = { title: "Set up your workspace — Nudge" };

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f3f5f2] px-4 py-6 text-neutral-950 sm:px-6 sm:py-9">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Logo />
        <span className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600">
          <LockKeyhole className="h-4 w-4 text-emerald-700" aria-hidden />
          Secure owner setup
        </span>
      </header>
      {children}
    </div>
  );
}

function InvalidSetupLink() {
  return (
    <PageFrame>
      <main className="mx-auto grid min-h-[calc(100dvh-7rem)] w-full max-w-xl place-items-center py-10">
        <section className="w-full rounded-[1.5rem] border border-neutral-200 bg-white p-7 shadow-[0_22px_65px_rgba(16,24,18,0.09)] sm:p-10">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-700">
            <Clock3 className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="mt-6 font-display text-3xl font-black tracking-[-0.03em]">
            This setup link is invalid or expired.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
            It may have expired, already been used, or been replaced. Ask Nudge
            for a new setup link before creating your password.
          </p>
          <Link
            href="/login"
            className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-black px-5 py-2.5 text-sm font-bold text-white hover:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            Sign in instead
          </Link>
        </section>
      </main>
    </PageFrame>
  );
}

export default async function OwnerSetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await findValidOwnerSetupInvite(token);
  if (!invite) return <InvalidSetupLink />;

  const expires = invite.setupTokenExpiresAt?.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <PageFrame>
      <main className="mx-auto grid min-h-[calc(100dvh-7rem)] w-full max-w-6xl place-items-center py-8 sm:py-12">
        <section className="grid w-full overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-[0_24px_70px_rgba(16,24,18,0.10)] lg:grid-cols-[0.92fr_1.08fr]">
          <div className="flex min-h-[24rem] flex-col bg-[#073d2c] p-7 text-white sm:p-10 lg:min-h-[38rem] lg:p-12">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
              Prepared by Nudge
            </span>
            <div className="my-auto py-10">
              <p className="text-sm font-semibold text-emerald-300">Your AI Front Desk</p>
              <h1 className="mt-3 max-w-md font-display text-4xl font-black leading-[1.04] tracking-[-0.04em] sm:text-5xl">
                {invite.org.name} is ready for you.
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-7 text-white/70">
                Choose your private password, then we&apos;ll take you straight to
                the guided setup for your business.
              </p>
            </div>
            <div className="flex items-start gap-3 border-t border-white/15 pt-5 text-sm leading-6 text-white/65">
              <Clock3 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
              <p>
                This private link expires on <span className="font-semibold text-white">{expires}</span>
                . It works once.
              </p>
            </div>
          </div>

          <div className="flex items-center p-7 sm:p-10 lg:p-14">
            <div className="mx-auto w-full max-w-md">
              <h2 className="font-display text-3xl font-black tracking-[-0.03em]">
                Create your login
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Your email is locked to this invitation. Only you choose the password.
              </p>
              <div className="mt-8">
                <OwnerSetupForm token={token} email={invite.email} />
              </div>
            </div>
          </div>
        </section>
      </main>
    </PageFrame>
  );
}


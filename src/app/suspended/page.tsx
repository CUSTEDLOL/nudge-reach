import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Workspace suspended · Nudge",
  robots: { index: false },
};

/**
 * Where a suspended workspace's members land (requireOrgContext redirects
 * here). Deliberately outside the (app) group so it never re-enters the org
 * shell and loops. Nothing here reads org data.
 */
export default function SuspendedPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-50 px-6 text-neutral-900">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-700">
          <ShieldAlert className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold">This workspace is suspended</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Your data is safe, but the AI Front Desk, campaigns and follow-ups are
          paused and the app is locked until Nudge lifts the suspension. If you
          think this is a mistake, reply to your onboarding email or write to
          support and we&apos;ll sort it out.
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

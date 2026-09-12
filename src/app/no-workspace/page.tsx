import type { Metadata } from "next";
import Link from "next/link";
import { MailQuestion } from "lucide-react";

export const metadata: Metadata = {
  title: "No workspace yet · Nudge",
  robots: { index: false },
};

/**
 * Where a signed-in account with no workspace and no invite lands. Nudge
 * creates workspaces on a demo call, so this is the expected end of the road
 * for anyone who signed in without being invited. Deliberately outside the
 * (app) group so it can never re-enter the org shell and loop, and it reads
 * no org data.
 */
export default function NoWorkspacePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-50 px-6 text-neutral-900">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700">
          <MailQuestion className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold">
          You&apos;re signed in, but there&apos;s no workspace here yet
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Nudge workspaces are set up for you. Book a demo and we&apos;ll build
          yours, then email an invite to this address so you can pick a password
          and walk straight in.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Already had a demo? Check the inbox of the email address you gave us —
          the invite has to go to the same one.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Book a demo
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

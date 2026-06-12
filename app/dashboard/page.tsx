import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureOrg } from "@/lib/org";
import { env } from "@/lib/env";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  const org = await ensureOrg(claims.sub, claims.email as string | undefined);

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">Nudge Reach</p>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Hello, {org.name} 👋
            </h1>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
            >
              Sign out
            </button>
          </form>
        </header>

        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-500">
            Foundation check (Phase 0)
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-800">
            <li>✅ Signed in as {(claims.email as string) ?? claims.sub}</li>
            <li>
              ✅ Org row in database: <span className="font-mono">{org.id}</span>
            </li>
            <li>
              ✅ Send mode: <span className="font-mono">{env.SEND_MODE}</span>
            </li>
          </ul>
          <p className="mt-4 text-sm text-neutral-500">
            Next up: campaign generation from a product photo.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-500">Quick links</h2>
          <div className="mt-3 flex gap-3">
            <a
              href="/contacts"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              👥 Customers & audiences
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { getWhatsappAccount } from "@/lib/whatsapp/accounts";
import { env } from "@/lib/env";
import { ConnectForm } from "@/app/settings/whatsapp/connect-form";

export default async function WhatsappSettingsPage() {
  const org = await requireOrg();
  const account = await getWhatsappAccount(org.id);

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-sm text-neutral-500">
          <Link href="/dashboard" className="hover:underline">
            ← Dashboard
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900">
          WhatsApp connection
        </h1>

        {env.SEND_MODE === "simulation" && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-semibold">🧪 You&apos;re in simulation mode</p>
            <p className="mt-1">
              Everything works without a WhatsApp account — sends and approvals
              are mocked. Connect a real account here whenever you&apos;re
              ready to go live.
            </p>
          </div>
        )}

        {account && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">✅ Connected: {account.displayName}</p>
            <p className="mt-1 font-mono text-xs">
              WABA {account.wabaId} · Phone {account.phoneNumberId}
            </p>
            <p className="mt-1 text-xs">
              Access token is stored encrypted. Submitting the form below
              replaces this connection.
            </p>
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">
            {account ? "Replace connection" : "Connect manually"}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            From your{" "}
            <a
              href="https://developers.facebook.com"
              className="text-emerald-700 underline"
              target="_blank"
              rel="noreferrer"
            >
              Meta developer app
            </a>
            : WhatsApp → API Setup. (Embedded Signup comes later — manual works
            for testing with Meta&apos;s test number.)
          </p>
          <div className="mt-4">
            <ConnectForm />
          </div>
        </section>
      </div>
    </main>
  );
}

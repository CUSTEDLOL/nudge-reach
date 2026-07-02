import { requireOrg } from "@/lib/auth";
import { getWhatsappAccount } from "@/lib/whatsapp/accounts";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/ui/page-header";
import { ConnectForm } from "./connect-form";

export default async function WhatsappSettingsPage() {
  const org = await requireOrg();
  const account = await getWhatsappAccount(org.id);

  return (
    <div className="max-w-xl">
      <PageHeader
        title="WhatsApp connection"
        description="Connect your WhatsApp Business account — or keep everything mocked in simulation."
      />

      {env.SEND_MODE === "simulation" && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold">🧪 You&apos;re in simulation mode</p>
          <p className="mt-1">
            Everything works without a WhatsApp account — sends and approvals
            are mocked. Connect a real account here whenever you&apos;re ready
            to go live.
          </p>
        </div>
      )}

      {account && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
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

      <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
        <h2 className="text-base font-semibold text-neutral-900">
          {account ? "Replace connection" : "Connect manually"}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          From your{" "}
          <a
            href="https://developers.facebook.com"
            className="text-brand-700 underline"
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
  );
}

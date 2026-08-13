import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  formatAmountMinor,
  SIM_USDC_ADDRESS,
  simulatedTxHash,
  USDC_NETWORK,
} from "@/modules/payments";
import { settleSimulatedPayment } from "./actions";

/**
 * Customer-facing hosted payment page — the shortUrl the agent sends in chat
 * for the usdc rail. Public by unguessable id (same access model as any
 * hosted provider page); payment state must always be fresh.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Complete your payment",
  robots: { index: false },
};

export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await prisma.paymentRequest.findUnique({
    where: { id },
    include: { org: { select: { name: true } } },
  });
  if (!request) notFound();

  const amount = formatAmountMinor(request.amountMinor, request.currency);
  const isUsdc = request.currency === "USDC";
  const isSimulation = request.provider === "simulation";
  const isPaid = request.status === "paid";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f8fbf1] px-4 py-10 text-neutral-900">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-neutral-500">
            {request.org.name}
          </p>
          <h1 className="mt-1 text-lg font-semibold">{request.purpose}</h1>
          <p className="mt-4 text-4xl font-bold tracking-tight">{amount}</p>

          {isSimulation && (
            <span className="mt-3 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Test mode — no real money moves
            </span>
          )}

          {isPaid ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-emerald-800">
                <CheckCircle2 className="h-5 w-5" /> Payment received
              </p>
              {request.paidAt && (
                <p className="mt-1 text-sm text-emerald-700">
                  {request.paidAt.toLocaleString("en-SG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
              {isUsdc && (
                <p className="mt-2 break-all font-mono text-xs text-emerald-700">
                  {isSimulation ? "Simulated tx: " : "Tx: "}
                  {simulatedTxHash(request.id)}
                </p>
              )}
            </div>
          ) : (
            <>
              {isUsdc && (
                <dl className="mt-6 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Network</dt>
                    <dd className="font-medium capitalize">{USDC_NETWORK}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Asset</dt>
                    <dd className="font-medium">USDC</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Pay to</dt>
                    <dd className="mt-1 break-all rounded-lg bg-white px-2 py-1.5 font-mono text-xs">
                      {SIM_USDC_ADDRESS}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Reference</dt>
                    <dd className="break-all font-mono text-xs">{request.id}</dd>
                  </div>
                </dl>
              )}

              {isSimulation && (
                <form action={settleSimulatedPayment.bind(null, request.id)}>
                  <button
                    type="submit"
                    className="mt-6 w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700"
                  >
                    {isUsdc ? "Simulate wallet payment" : "Simulate payment"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Secured by Nudge
          {isUsdc && !isPaid && (
            <span>
              · machine-payable via{" "}
              <code className="font-mono">x402</code>
            </span>
          )}
        </p>
      </div>
    </main>
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  SIM_USDC_ADDRESS,
  simulatedTxHash,
  USDC_NETWORK,
} from "@/modules/payments";

/**
 * Machine-payments surface for the usdc rail (x402-style): an unpaid request
 * answers HTTP 402 with structured payment instructions any agent or wallet
 * can act on; a settled one answers 200 with the receipt. Fiat requests are
 * not machine-payable and 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await prisma.paymentRequest.findUnique({
    where: { id },
    select: {
      id: true,
      amountMinor: true,
      currency: true,
      purpose: true,
      status: true,
      provider: true,
      paidAt: true,
      shortUrl: true,
    },
  });
  if (!row || row.currency !== "USDC") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (row.status === "paid") {
    return NextResponse.json({
      status: "paid",
      reference: row.id,
      network: USDC_NETWORK,
      asset: "USDC",
      paidAt: row.paidAt,
      ...(row.provider === "simulation"
        ? { simulatedTxHash: simulatedTxHash(row.id) }
        : {}),
    });
  }

  // amountMinor is USDC cents; on-chain USDC uses 6 decimals.
  const atomicAmount = String(row.amountMinor * 10_000);
  return NextResponse.json(
    {
      x402Version: 1,
      error: "Payment required",
      accepts: [
        {
          scheme: "exact",
          network: USDC_NETWORK,
          asset: "USDC",
          maxAmountRequired: atomicAmount,
          payTo: SIM_USDC_ADDRESS,
          resource: row.shortUrl,
          description: row.purpose,
          extra: { reference: row.id },
        },
      ],
    },
    { status: 402 }
  );
}

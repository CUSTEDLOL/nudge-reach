import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/auth";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  DRAFT: { text: "Draft", cls: "bg-neutral-100 text-neutral-600" },
  TEMPLATE_PENDING: { text: "Waiting for approval", cls: "bg-amber-50 text-amber-700" },
  TEMPLATE_APPROVED: { text: "Approved — ready to send", cls: "bg-emerald-50 text-emerald-700" },
  SENDING: { text: "Sending…", cls: "bg-blue-50 text-blue-700" },
  SENT: { text: "Sent", cls: "bg-emerald-50 text-emerald-700" },
  FAILED: { text: "Failed", cls: "bg-red-50 text-red-700" },
};

export default async function CampaignsPage() {
  const org = await requireOrg();
  const campaigns = await prisma.campaign.findMany({
    where: { orgId: org.id },
    include: { product: { select: { photoUrl: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">
              <Link href="/dashboard" className="hover:underline">
                ← Dashboard
              </Link>
            </p>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Campaigns
            </h1>
          </div>
          <Link
            href="/campaigns/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + New campaign
          </Link>
        </header>

        {campaigns.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <p className="text-3xl">📸</p>
            <h2 className="mt-2 text-lg font-semibold text-neutral-900">
              Your first campaign is one photo away
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Upload a product photo and we&apos;ll write the whole WhatsApp
              message for you.
            </p>
            <Link
              href="/campaigns/new"
              className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Create a campaign
            </Link>
          </section>
        ) : (
          <ul className="space-y-3">
            {campaigns.map((c) => {
              const status = STATUS_LABEL[c.status] ?? STATUS_LABEL.DRAFT;
              return (
                <li key={c.id}>
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-emerald-300"
                  >
                    {c.product.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.product.photoUrl}
                        alt=""
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-neutral-100 text-xl">
                        🛍️
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-neutral-900">{c.name}</p>
                      <p className="text-xs text-neutral-400">
                        Created{" "}
                        {new Intl.DateTimeFormat("en-IN", {
                          dateStyle: "medium",
                        }).format(c.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}
                    >
                      {status.text}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

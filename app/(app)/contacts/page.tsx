import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { canSendMarketing } from "@/lib/consent";
import { PageHeader } from "@/components/ui/page-header";
import { AddContactForm, CreateAudienceForm, CsvImportForm } from "./forms";
import { deleteAudience, deleteContact, optOutContact } from "./actions";

export default async function ContactsPage() {
  const org = await requireOrg();

  const [contacts, audiences] = await Promise.all([
    prisma.contact.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.audience.findMany({
      where: { orgId: org.id },
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const optedIn = contacts.filter(canSendMarketing);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Customers"
        description={`${contacts.length} total · ${optedIn.length} can receive campaigns`}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <h2 className="text-base font-semibold text-neutral-900">
            Add one customer
          </h2>
          <div className="mt-4">
            <AddContactForm />
          </div>
        </section>

        <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <h2 className="text-base font-semibold text-neutral-900">
            Import a list
          </h2>
          <div className="mt-4">
            <CsvImportForm />
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
        <h2 className="text-base font-semibold text-neutral-900">
          Your customers
        </h2>
        {contacts.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No customers yet. Add one on the left, or paste a list.
          </p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs uppercase text-neutral-400">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Number</th>
                <th className="py-2">Campaigns?</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td className="py-2 font-medium text-neutral-800">
                    {c.name}
                  </td>
                  <td className="py-2 font-mono text-xs text-neutral-500">
                    {c.phoneE164}
                  </td>
                  <td className="py-2">
                    {canSendMarketing(c) ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Yes — opted in
                      </span>
                    ) : c.optedOutAt ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        Opted out
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                        No consent
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {canSendMarketing(c) && (
                        <form action={optOutContact}>
                          <input type="hidden" name="contactId" value={c.id} />
                          <button className="text-xs text-neutral-500 hover:text-red-600 hover:underline">
                            Opt out
                          </button>
                        </form>
                      )}
                      <form action={deleteContact}>
                        <input type="hidden" name="contactId" value={c.id} />
                        <button className="text-xs text-neutral-400 hover:text-red-600 hover:underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <h2 className="text-base font-semibold text-neutral-900">
            New audience
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            A group of customers to send a campaign to.
          </p>
          <div className="mt-4">
            <CreateAudienceForm
              contacts={optedIn.map((c) => ({
                id: c.id,
                name: c.name,
                phoneE164: c.phoneE164,
              }))}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <h2 className="text-base font-semibold text-neutral-900">
            Your audiences
          </h2>
          {audiences.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No audiences yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {audiences.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-neutral-800">
                    {a.name}
                    <span className="ml-2 text-xs font-normal text-neutral-400">
                      {a._count.contacts} customer
                      {a._count.contacts === 1 ? "" : "s"}
                    </span>
                  </span>
                  <form action={deleteAudience}>
                    <input type="hidden" name="audienceId" value={a.id} />
                    <button className="text-xs text-neutral-400 hover:text-red-600 hover:underline">
                      Delete
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

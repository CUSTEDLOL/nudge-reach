import { requireFounder } from "@/modules/admin/auth";
import { teamOverview } from "@/modules/admin/team";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionForm } from "@/components/features/admin-shell/action-form";
import {
  removeMemberAction,
  revokeInviteAction,
  setMemberRoleAction,
  transferOwnershipAction,
} from "../actions";

const selectCls =
  "h-9 rounded-lg border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-neutral-500";

const ROLE_TONE = { OWNER: "brand", ADMIN: "info", AGENT: "neutral" } as const;

/** Members, pending invites, and the levers the client can't pull themselves. */
export default async function AdminOrgTeamPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFounder();
  const { id } = await params;
  const { members, invites } = await teamOverview(id);
  const owners = members.filter((m) => m.role === "OWNER").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>
            Role changes and removals follow the same rule as the client&apos;s own team page: the org can
            never be left without an owner. Transfer ownership makes one person the accountable owner and
            steps every other owner down to admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-neutral-100">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.displayName || m.email || "(no email on record)"}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {m.email || "—"} · joined {m.createdAt.toLocaleDateString("en-GB")}
                    {m.whatsappAccountIds.length > 0 && ` · ${m.whatsappAccountIds.length} number(s) assigned`}
                  </p>
                </div>
                <Badge tone={ROLE_TONE[m.role]}>{m.role.toLowerCase()}</Badge>
                <ActionForm
                  action={setMemberRoleAction}
                  hidden={{ orgId: id, membershipId: m.id }}
                  submitLabel="Set role"
                  confirm={{ title: `Change ${m.displayName || m.email}'s role?` }}
                  askReason
                  className="flex items-center gap-2"
                >
                  <select name="role" defaultValue={m.role} className={selectCls} aria-label="Role">
                    <option value="OWNER">owner</option>
                    <option value="ADMIN">admin</option>
                    <option value="AGENT">agent</option>
                  </select>
                </ActionForm>
                {m.role !== "OWNER" || owners > 1 ? (
                  <ActionForm
                    action={transferOwnershipAction}
                    hidden={{ orgId: id, membershipId: m.id }}
                    submitLabel="Make owner"
                    variant="ghost"
                    disabled={m.role === "OWNER" && owners === 1}
                    confirm={{
                      title: `Transfer ownership to ${m.displayName || m.email}?`,
                      description: "They become the single owner; other owners become admins.",
                      danger: true,
                    }}
                    askReason
                  />
                ) : null}
                <ActionForm
                  action={removeMemberAction}
                  hidden={{ orgId: id, membershipId: m.id }}
                  submitLabel="Remove"
                  variant="ghost"
                  disabled={m.role === "OWNER" && owners === 1}
                  confirm={{
                    title: `Remove ${m.displayName || m.email} from this workspace?`,
                    description: "They lose access immediately. Their past actions stay in the audit log.",
                    danger: true,
                  }}
                  askReason
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invites ({invites.length})</CardTitle>
          <CardDescription>
            An invite is accepted automatically when that email signs in. Revoking deletes it.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {invites.length === 0 ? (
            <p className="px-5 py-4 text-sm text-neutral-400">No pending invites.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {invites.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-neutral-500">
                      invited {inv.createdAt.toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <Badge tone={ROLE_TONE[inv.role]}>{inv.role.toLowerCase()}</Badge>
                  <ActionForm
                    action={revokeInviteAction}
                    hidden={{ orgId: id, inviteId: inv.id }}
                    submitLabel="Revoke"
                    variant="ghost"
                    confirm={{ title: `Revoke the invite for ${inv.email}?` }}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import { Info } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionHeader } from "../section-header";
import { InviteForm } from "./invite-form";
import { MemberRoleSelect } from "./role-select";
import { RevokeInviteButton } from "./revoke-invite-button";

export const metadata: Metadata = { title: "Team settings" };

const ROLE_TONE: Record<string, BadgeTone> = {
  OWNER: "brand",
  ADMIN: "info",
  AGENT: "neutral",
};

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function TeamSettingsPage() {
  const ctx = await requireOrgContext();
  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invite.findMany({
      where: { orgId: ctx.org.id, status: "pending" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const canManage = hasRole(ctx.role, "ADMIN");

  return (
    <section className="flex flex-col gap-6">
      <div>
        <SectionHeader
          title="Team"
          description={`${members.length} member${members.length === 1 ? "" : "s"} in ${ctx.org.name}. Owners manage everything; admins manage everything except billing; agents work the inbox and contacts.`}
        />
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-t-0 hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const name =
                  member.displayName ||
                  (member.email ? member.email.split("@")[0] : "Member");
                const isSelf = member.userId === ctx.userId;
                // Admins can't touch owner seats; only owners can.
                const editable =
                  canManage &&
                  (ctx.role === "OWNER" || member.role !== "OWNER");
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={name} size="md" className="hidden sm:inline-flex" />
                        <div className="min-w-0 max-w-36 sm:max-w-none">
                          <p className="truncate text-sm font-medium text-neutral-900">
                            {name}
                            {isSelf && (
                              <span className="ml-2 text-xs font-normal text-neutral-400">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-neutral-500">
                            {member.email || "No email on file"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <MemberRoleSelect
                          key={`${member.id}-${member.role}`}
                          membershipId={member.id}
                          role={member.role}
                          actorIsOwner={ctx.role === "OWNER"}
                        />
                      ) : (
                        <Badge tone={ROLE_TONE[member.role] ?? "neutral"}>
                          {member.role.charAt(0) +
                            member.role.slice(1).toLowerCase()}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-neutral-500 sm:table-cell">
                      {dateFmt.format(member.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {canManage && (
        <div>
          <SectionHeader
            title="Invite a teammate"
            description="No invite emails in the MVP — share the signup link yourself."
          />
          <Card className="p-6">
            <InviteForm />
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50 p-3.5 text-sm text-sky-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                Invitees join this workspace automatically the first time they
                sign up (or sign in) with the invited email address — with the
                role you picked here.
              </p>
            </div>
          </Card>
        </div>
      )}

      {canManage && invites.length > 0 && (
        <div>
          <SectionHeader
            title="Pending invites"
            description="Waiting for the invitee to sign up with this email."
          />
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Invited</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="text-sm text-neutral-900">
                      {invite.email}
                    </TableCell>
                    <TableCell>
                      <Badge tone={ROLE_TONE[invite.role] ?? "neutral"}>
                        {invite.role.charAt(0) +
                          invite.role.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-neutral-500 sm:table-cell">
                      {dateFmt.format(invite.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RevokeInviteButton inviteId={invite.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </section>
  );
}

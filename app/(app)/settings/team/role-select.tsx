"use client";

import { useState, useTransition } from "react";
import type { OrgRole } from "@prisma/client";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { updateMemberRoleAction } from "./actions";

/**
 * Inline role picker for one member row. Optimistic value with rollback on
 * server refusal (e.g. demoting the last owner).
 */
export function MemberRoleSelect({
  membershipId,
  role,
  actorIsOwner,
}: {
  membershipId: string;
  role: OrgRole;
  actorIsOwner: boolean;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState<OrgRole>(role);
  const [pending, startTransition] = useTransition();

  function handleChange(next: OrgRole) {
    setValue(next);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("membershipId", membershipId);
      formData.set("role", next);
      const result = await updateMemberRoleAction(formData);
      toast({
        description: result.message,
        tone: result.ok ? "success" : "error",
      });
      if (!result.ok) setValue(role);
    });
  }

  return (
    <Select
      aria-label="Member role"
      value={value}
      disabled={pending}
      onChange={(event) => handleChange(event.target.value as OrgRole)}
      className="w-32"
    >
      {actorIsOwner && <option value="OWNER">Owner</option>}
      <option value="ADMIN">Admin</option>
      <option value="AGENT">Agent</option>
    </Select>
  );
}

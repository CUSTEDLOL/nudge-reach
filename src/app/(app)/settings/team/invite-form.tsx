"use client";

import { useActionState, useRef } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { inviteMemberAction, type ActionResult } from "./actions";

export function InviteForm() {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await inviteMemberAction(formData);
      toast({
        description: result.message,
        tone: result.ok ? "success" : "error",
      });
      if (result.ok) formRef.current?.reset();
      return result;
    },
    null
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
    >
      <Field
        label="Email address"
        htmlFor="invite-email"
        required
        className="flex-1"
      >
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="teammate@example.com"
        />
      </Field>
      <Field label="Role" htmlFor="invite-role" className="sm:w-36">
        <Select id="invite-role" name="role" defaultValue="AGENT">
          <option value="AGENT">Agent</option>
          <option value="ADMIN">Admin</option>
        </Select>
      </Field>
      <Button type="submit" loading={pending} className="sm:mb-0">
        {!pending && <UserPlus className="h-4 w-4" aria-hidden />}
        Send invite
      </Button>
    </form>
  );
}

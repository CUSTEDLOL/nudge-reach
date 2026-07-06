"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { revokeInviteAction } from "./actions";

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function handleRevoke() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("inviteId", inviteId);
      const result = await revokeInviteAction(formData);
      toast({
        description: result.message,
        tone: result.ok ? "success" : "error",
      });
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRevoke}
      loading={pending}
      className="text-red-600 hover:bg-red-50 hover:text-red-700"
    >
      Revoke
    </Button>
  );
}

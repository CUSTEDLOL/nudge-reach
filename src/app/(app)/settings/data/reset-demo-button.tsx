"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { resetDemoDataAction } from "./actions";

/** Owner-only, simulation-only demo reset with an explicit confirm step. */
export function ResetDemoButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    const result = await resetDemoDataAction();
    toast({
      tone: result.ok ? "success" : "error",
      description: result.message,
    });
    setOpen(false);
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        Reset demo data
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="Reset the demo workspace?"
        description="All contacts, conversations, campaigns, templates, tags and automations in this workspace are deleted and replaced with fresh demo data. Team members, the WhatsApp connection, API keys and webhooks are kept. This can't be undone."
        confirmLabel="Reset demo data"
        tone="danger"
      />
    </>
  );
}

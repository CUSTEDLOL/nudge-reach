"use client";

import { useTransition } from "react";
import { PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { testWhatsappConnectionAction } from "./actions";

export function TestConnectionButton() {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function handleTest() {
    startTransition(async () => {
      const result = await testWhatsappConnectionAction();
      toast({
        title: result.ok ? "Connection OK" : "Connection failed",
        description: result.message,
        tone: result.ok ? "success" : "error",
      });
    });
  }

  return (
    <Button variant="secondary" onClick={handleTest} loading={pending}>
      {!pending && <PlugZap className="h-4 w-4" aria-hidden />}
      Test connection
    </Button>
  );
}

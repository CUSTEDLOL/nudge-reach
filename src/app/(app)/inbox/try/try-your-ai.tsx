"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { simulateInboundAction } from "../actions";

const STARTERS = [
  "What are your timings?",
  "How much does a consultation cost?",
  "Can I book for tomorrow at 5pm?",
  "Do you have parking?",
];

export function TryYourAi({
  simulation,
  dialCode,
  connectedName,
}: {
  simulation: boolean;
  dialCode: string;
  connectedName: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [phone, setPhone] = useState("9876500001");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (sending || !text.trim()) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("phone", phone);
      fd.set("text", text);
      const result = await simulateInboundAction(fd);
      if (!result.ok) {
        toast({ tone: "error", description: result.message });
        return;
      }
      if (result.skipped) toast({ tone: "error", description: result.message });
      if (result.conversationId) {
        router.push(`/inbox/${result.conversationId}`);
        return;
      }
      toast({ tone: "success", description: result.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="p-6">
      {!simulation && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <span>
            Replies stay on this screen — the test customer gets a practice
            number, so nothing is sent to a real phone.
            {connectedName
              ? ` To test on a real phone, message “${connectedName}” from WhatsApp.`
              : ""}
          </span>
        </p>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div>
          <Label htmlFor="try-phone">Test customer&apos;s number (any number works)</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-sm text-neutral-500">{dialCode}</span>
            <Input
              id="try-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="max-w-xs"
              disabled={sending}
            />
          </div>
          <p className="mt-1.5 text-xs text-neutral-400">
            Change the number to start a fresh conversation.
          </p>
        </div>
        <div>
          <Label htmlFor="try-text">Message as the customer</Label>
          <Textarea
            id="try-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="e.g. Are you open on Sunday?"
            className="mt-1.5"
            disabled={sending}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setText(s)}
                className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition-colors hover:border-brand-400 hover:text-brand-700"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">
            Replies use only the facts on your AI Front Desk page — teach it more
            and try again.
          </p>
          <Button type="submit" loading={sending} disabled={!text.trim()}>
            <MessageSquare className="h-4 w-4" aria-hidden />
            Send as customer
          </Button>
        </div>
      </form>
    </Card>
  );
}

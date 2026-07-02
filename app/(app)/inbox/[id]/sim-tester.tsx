"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { simulateInboundAction } from "../actions";

/**
 * Simulation-mode tester: post an inbound message as the customer, routed
 * through the exact handler the live webhook uses (lib/agent/inbound.ts).
 * Collapsible so it stays out of the way during demos.
 */
export function SimTester({
  conversationPhone,
  onPosted,
}: {
  conversationPhone: string;
  onPosted: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(conversationPhone);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("phone", phone);
      fd.set("text", text);
      const result = await simulateInboundAction(fd);
      toast({
        tone: result.ok ? "success" : "error",
        description: result.message,
      });
      if (result.ok) {
        setText("");
        await onPosted();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-dashed border-sky-200 bg-sky-50/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-sky-800 outline-none transition-colors duration-150 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-brand-400/50"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        )}
        <FlaskConical className="h-3.5 w-3.5" aria-hidden />
        Test as customer
        <span className="ml-auto rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
          simulation
        </span>
      </button>
      {open && (
        <form
          className="flex flex-col gap-2 px-3 pb-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-label="Customer phone"
            placeholder="+91…"
            className="sm:w-40"
            disabled={sending}
          />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Customer message"
            placeholder="e.g. Do you have this in size M?"
            className="flex-1"
            disabled={sending}
          />
          <Button
            type="submit"
            size="sm"
            className="sm:h-9"
            loading={sending}
            disabled={!phone.trim() || !text.trim()}
          >
            Send as customer
          </Button>
        </form>
      )}
    </div>
  );
}

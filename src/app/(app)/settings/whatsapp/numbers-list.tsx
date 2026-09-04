"use client";

import { useState } from "react";
import { Star, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { setDefaultNumberAction, disconnectNumberAction } from "./actions";

export interface SerializedNumber {
  id: string;
  displayName: string;
  phoneNumberId: string;
  wabaId: string;
  isDefault: boolean;
  status: string;
}

export function NumbersList({
  numbers,
  canManage,
}: {
  numbers: SerializedNumber[];
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [disconnectId, setDisconnectId] = useState<string | null>(null);

  async function makeDefault(id: string) {
    const fd = new FormData();
    fd.set("accountId", id);
    const res = await setDefaultNumberAction(fd);
    toast({ tone: res.ok ? "success" : "error", description: res.message });
  }

  async function disconnect() {
    if (!disconnectId) return;
    const fd = new FormData();
    fd.set("accountId", disconnectId);
    const res = await disconnectNumberAction(fd);
    toast({ tone: res.ok ? "success" : "error", description: res.message });
    setDisconnectId(null);
  }

  return (
    <Card className="p-5">
      <ul className="flex flex-col divide-y divide-neutral-100">
        {numbers.map((n) => (
          <li
            key={n.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone="success">Connected</Badge>
                <p className="text-sm font-semibold text-neutral-900">
                  {n.displayName}
                </p>
                {n.isDefault && <Badge tone="brand">Default</Badge>}
              </div>
              <p className="mt-1 font-mono text-xs text-neutral-500">
                WABA {n.wabaId} · Phone {n.phoneNumberId}
              </p>
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-2">
                {!n.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => makeDefault(n.id)}>
                    <Star className="h-4 w-4" aria-hidden />
                    Make default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisconnectId(n.id)}
                  aria-label={`Disconnect ${n.displayName}`}
                >
                  <Unplug className="h-4 w-4 text-red-500" aria-hidden />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={disconnectId !== null}
        onClose={() => setDisconnectId(null)}
        onConfirm={disconnect}
        title="Disconnect this number?"
        description="Sending stops from this number immediately. Its conversations stay in the inbox and fall back to your default number."
        confirmLabel="Disconnect"
      />
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { KeyRound, Plus, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { CopyButton } from "./copy-button";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

export interface SerializedApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string; // ISO
  lastUsedAt: string | null; // ISO
  revoked: boolean;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function ApiKeysCard({
  keys,
  canManage,
  gateMessage,
}: {
  keys: SerializedApiKey[];
  canManage: boolean;
  /** Set when the org's plan lacks publicApi (E0) — renders the upsell instead of the create button. */
  gateMessage?: string | null;
}) {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<SerializedApiKey | null>(
    null
  );
  const [creating, startCreating] = useTransition();

  function closeModal() {
    setModalOpen(false);
    setCreatedKey(null);
    setName("");
  }

  function handleCreate() {
    startCreating(async () => {
      const formData = new FormData();
      formData.set("name", name);
      const result = await createApiKeyAction(formData);
      if (result.ok && result.key) {
        setCreatedKey(result.key);
      } else {
        toast({ description: result.message, tone: "error" });
      }
    });
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    const formData = new FormData();
    formData.set("id", revokeTarget.id);
    const result = await revokeApiKeyAction(formData);
    toast({
      description: result.message,
      tone: result.ok ? "success" : "error",
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-neutral-400" aria-hidden />
              API keys
            </CardTitle>
            <CardDescription>
              Programmatic access for the upcoming public API. Keys are hashed
              at rest — the full key is shown once at creation.
            </CardDescription>
          </div>
          {canManage &&
            (gateMessage ? (
              <p className="max-w-56 text-right text-xs text-neutral-500">
                {gateMessage}
              </p>
            ) : (
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Create key
              </Button>
            ))}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {keys.length === 0 ? (
          <p className="border-t border-neutral-100 px-5 py-8 text-center text-sm text-neutral-500">
            No API keys yet
            {canManage ? " — create one to integrate your own tools." : "."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-mono text-xs text-neutral-600">
                      {apiKey.prefix}…
                    </TableCell>
                    <TableCell className="text-sm text-neutral-900">
                      {apiKey.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-neutral-500">
                      {dateFmt.format(new Date(apiKey.createdAt))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-neutral-500">
                      {apiKey.lastUsedAt
                        ? dateFmt.format(new Date(apiKey.lastUsedAt))
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      {apiKey.revoked ? (
                        <Badge tone="danger">Revoked</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {!apiKey.revoked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setRevokeTarget(apiKey)}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={createdKey ? "Copy your API key" : "Create API key"}
        description={
          createdKey
            ? "This is the only time the full key is shown. Store it somewhere safe."
            : "Name it after where it'll be used so you can revoke it later."
        }
        footer={
          createdKey ? (
            <Button onClick={closeModal}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                loading={creating}
                disabled={!name.trim()}
              >
                Create key
              </Button>
            </>
          )
        }
      >
        {createdKey ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <code className="min-w-0 break-all font-mono text-sm text-neutral-900">
                {createdKey}
              </code>
              <CopyButton value={createdKey} label="Copy API key" />
            </div>
            <p className="flex items-start gap-2 text-xs text-amber-700">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Only the hash is stored — if you lose this key, revoke it and
              create a new one.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleCreate();
            }}
          >
            <Field label="Key name" htmlFor="api-key-name" required>
              <Input
                id="api-key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Zapier production"
                maxLength={60}
                autoFocus
              />
            </Field>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title={`Revoke “${revokeTarget?.name ?? ""}”?`}
        description="Anything using this key loses access immediately. This can't be undone."
        confirmLabel="Revoke key"
        tone="danger"
      />
    </Card>
  );
}

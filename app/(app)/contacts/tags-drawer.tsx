"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/modal";
import { TagPill } from "@/components/ui/tag-pill";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { createTag, deleteTag, renameTag } from "./actions";
import { TAG_COLORS, TAG_SWATCH, type TagInfo } from "./types";

function ColorPicker({
  value,
  onChange,
  idPrefix,
}: {
  value: string;
  onChange: (color: string) => void;
  idPrefix: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Tag color"
      className="flex items-center gap-1.5"
    >
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={`${color} (${idPrefix})`}
          onClick={() => onChange(color)}
          className={cn(
            "h-5 w-5 rounded-full outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-brand-400/50",
            TAG_SWATCH[color],
            value === color && "ring-2 ring-neutral-900 ring-offset-1"
          )}
        />
      ))}
    </div>
  );
}

/** Create / rename / recolor / delete org tags (delete is admin-only). */
export function TagsDrawer({
  open,
  onClose,
  tags,
  canManage,
}: {
  open: boolean;
  onClose: () => void;
  tags: TagInfo[];
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("emerald");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>("emerald");
  const [deleting, setDeleting] = useState<TagInfo | null>(null);

  function run(fd: FormData, action: typeof createTag, after?: () => void) {
    startTransition(async () => {
      const res = await action(fd);
      toast({ description: res.message, tone: res.ok ? "success" : "error" });
      if (res.ok) after?.();
    });
  }

  function handleCreate() {
    const fd = new FormData();
    fd.set("name", newName);
    fd.set("color", newColor);
    run(fd, createTag, () => setNewName(""));
  }

  function handleRename() {
    if (!editingId) return;
    const fd = new FormData();
    fd.set("tagId", editingId);
    fd.set("name", editName);
    fd.set("color", editColor);
    run(fd, renameTag, () => setEditingId(null));
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Tags"
      description="Labels for grouping contacts — filters, segments and automations use them."
    >
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          New tag
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. VIP, Diwali sale"
            aria-label="New tag name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleCreate}
            loading={pending}
            disabled={!newName.trim()}
          >
            Add
          </Button>
        </div>
        <ColorPicker value={newColor} onChange={setNewColor} idPrefix="new tag" />
      </div>

      <ul className="mt-4 divide-y divide-neutral-100">
        {tags.length === 0 && (
          <li className="py-6 text-center text-sm text-neutral-500">
            No tags yet — create your first one above.
          </li>
        )}
        {tags.map((tag) =>
          editingId === tag.id ? (
            <li key={tag.id} className="flex flex-col gap-2 py-3">
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  aria-label={`Rename tag ${tag.name}`}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleRename}
                  loading={pending}
                  aria-label="Save tag"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                  aria-label="Cancel rename"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
              <ColorPicker
                value={editColor}
                onChange={setEditColor}
                idPrefix={tag.name}
              />
            </li>
          ) : (
            <li key={tag.id} className="flex items-center gap-2 py-2.5">
              <TagPill label={tag.name} color={tag.color} />
              <span className="text-xs text-neutral-400">
                {tag.contactCount} contact{tag.contactCount === 1 ? "" : "s"}
              </span>
              <span className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(tag.id);
                    setEditName(tag.name);
                    setEditColor(tag.color);
                  }}
                  aria-label={`Edit tag ${tag.name}`}
                  className="rounded-lg p-1.5 text-neutral-400 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-brand-400/50"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setDeleting(tag)}
                    aria-label={`Delete tag ${tag.name}`}
                    className="rounded-lg p-1.5 text-neutral-400 outline-none transition-colors duration-150 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-brand-400/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </span>
            </li>
          )
        )}
      </ul>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete tag “${deleting?.name}”?`}
        description="It will be removed from every contact and conversation. This cannot be undone."
        confirmLabel="Delete tag"
        tone="danger"
        onConfirm={async () => {
          if (!deleting) return;
          const fd = new FormData();
          fd.set("tagId", deleting.id);
          const res = await deleteTag(fd);
          toast({ description: res.message, tone: res.ok ? "success" : "error" });
        }}
      />
    </Drawer>
  );
}

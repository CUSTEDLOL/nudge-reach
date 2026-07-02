"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
  submitTemplateAction,
} from "./actions";

export interface TemplateListRow {
  id: string;
  name: string;
  displayName: string;
  bodyPreview: string;
  category: string;
  language: string;
  status: string;
  rejectionReason: string | null;
  updatedAt: string;
}

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING: { label: "In review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

const CATEGORY_TONE: Record<string, BadgeTone> = {
  MARKETING: "brand",
  UTILITY: "info",
  AUTHENTICATION: "neutral",
};

const LANGUAGE_LABEL: Record<string, string> = { en: "English", hi: "Hindi" };

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export function TemplatesList({
  templates,
  canManage,
}: {
  templates: TemplateListRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<TemplateListRow | null>(null);
  // Poll results override server props until revalidation catches up.
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const rows = useMemo(
    () =>
      templates.map((t) => ({
        ...t,
        status: overrides[t.id] ?? t.status,
      })),
    [templates, overrides]
  );

  // Poll pending templates every 4s until the (simulated) review settles.
  const pendingIds = useMemo(
    () => rows.filter((r) => r.status === "PENDING").map((r) => r.id),
    [rows]
  );
  useEffect(() => {
    if (pendingIds.length === 0) return;
    let cancelled = false;

    async function tick() {
      const results = await Promise.all(
        pendingIds.map(async (id) => {
          try {
            const res = await fetch(`/api/templates/${id}/status`, {
              cache: "no-store",
            });
            if (!res.ok) return null;
            const body = (await res.json()) as { status?: string };
            return body.status ? { id, status: body.status } : null;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const settled = results.filter(
        (r): r is { id: string; status: string } =>
          r !== null && r.status !== "PENDING"
      );
      if (settled.length === 0) return;
      setOverrides((prev) => ({
        ...prev,
        ...Object.fromEntries(settled.map((s) => [s.id, s.status])),
      }));
      for (const s of settled) {
        const name = templates.find((t) => t.id === s.id)?.displayName ?? "Template";
        toast({
          tone: s.status === "APPROVED" ? "success" : "error",
          title: s.status === "APPROVED" ? "Template approved" : "Template rejected",
          description:
            s.status === "APPROVED"
              ? `“${name}” is ready to use in campaigns and replies.`
              : `“${name}” was rejected — open it to see why.`,
        });
      }
      router.refresh();
    }

    const interval = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pendingIds, templates, toast, router]);

  function runAction(
    action: (formData: FormData) => Promise<{ ok: boolean; message: string }>,
    id: string
  ) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      const result = await action(formData);
      toast({
        tone: result.ok ? "success" : "error",
        description: result.message,
      });
      if (result.ok) router.refresh();
    });
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: rows.length };
    for (const r of rows) map[r.status] = (map[r.status] ?? 0) + 1;
    return map;
  }, [rows]);

  const filtered = rows.filter(
    (r) =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (categoryFilter === "all" || r.category === categoryFilter)
  );

  const columns: DataTableColumn<TemplateListRow>[] = [
    {
      key: "name",
      header: "Template",
      sortValue: (r) => r.displayName,
      cell: (r) => (
        <div className="min-w-0">
          <Link
            href={`/templates/${r.id}`}
            className="font-medium text-neutral-900 outline-none transition-colors duration-150 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400/50"
          >
            {r.displayName}
          </Link>
          <p className="mt-0.5 truncate font-mono text-xs text-neutral-400">
            {r.name}
          </p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortValue: (r) => r.category,
      cell: (r) => (
        <Badge tone={CATEGORY_TONE[r.category] ?? "neutral"}>
          {r.category.charAt(0) + r.category.slice(1).toLowerCase()}
        </Badge>
      ),
    },
    {
      key: "language",
      header: "Language",
      sortValue: (r) => r.language,
      cell: (r) => (
        <span className="text-neutral-600">
          {LANGUAGE_LABEL[r.language] ?? r.language}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      cell: (r) => {
        const meta = STATUS_META[r.status] ?? STATUS_META.DRAFT;
        return (
          <Badge tone={meta.tone}>
            {r.status === "PENDING" && (
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                aria-hidden
              />
            )}
            {meta.label}
          </Badge>
        );
      },
    },
    {
      key: "updatedAt",
      header: "Updated",
      sortValue: (r) => r.updatedAt,
      cell: (r) => (
        <span className="text-xs text-neutral-500">
          {dateFormat.format(new Date(r.updatedAt))}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) =>
        canManage ? (
          <Menu
            trigger={<MoreHorizontal className="h-4 w-4 text-neutral-500" aria-hidden />}
            triggerLabel={`Actions for ${r.displayName}`}
            triggerClassName="p-1.5 hover:bg-black/5"
          >
            <MenuItem href={`/templates/${r.id}`} icon={<Pencil className="h-4 w-4" aria-hidden />}>
              Edit
            </MenuItem>
            <MenuItem
              onSelect={() => runAction(duplicateTemplateAction, r.id)}
              icon={<Copy className="h-4 w-4" aria-hidden />}
            >
              Duplicate
            </MenuItem>
            {(r.status === "DRAFT" || r.status === "REJECTED") && (
              <MenuItem
                onSelect={() => runAction(submitTemplateAction, r.id)}
                icon={<Send className="h-4 w-4" aria-hidden />}
              >
                Submit for review
              </MenuItem>
            )}
            {(r.status === "DRAFT" || r.status === "REJECTED") && (
              <>
                <MenuSeparator />
                <MenuItem
                  danger
                  onSelect={() => setDeleteTarget(r)}
                  icon={<Trash2 className="h-4 w-4" aria-hidden />}
                >
                  Delete
                </MenuItem>
              </>
            )}
          </Menu>
        ) : (
          <Link
            href={`/templates/${r.id}`}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            View
          </Link>
        ),
    },
  ];

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={<LayoutTemplate className="h-5 w-5" aria-hidden />}
        title="No templates yet"
        description="Create a reusable message template, submit it for Meta review, and use it in campaigns and inbox replies."
        action={
          canManage ? (
            <Link href="/templates/new" className={buttonVariants()}>
              New template
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <Tabs
        aria-label="Filter templates by status"
        className="mb-4"
        value={statusFilter}
        onValueChange={setStatusFilter}
        items={[
          { value: "all", label: "All", count: counts.all },
          { value: "DRAFT", label: "Draft", count: counts.DRAFT ?? 0 },
          { value: "PENDING", label: "In review", count: counts.PENDING ?? 0 },
          { value: "APPROVED", label: "Approved", count: counts.APPROVED ?? 0 },
          { value: "REJECTED", label: "Rejected", count: counts.REJECTED ?? 0 },
        ]}
      />
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        searchValue={(r) => `${r.displayName} ${r.name} ${r.bodyPreview}`}
        searchPlaceholder="Search templates…"
        initialSort={{ key: "updatedAt", dir: "desc" }}
        emptyMessage="No templates match these filters."
        toolbar={
          <Select
            aria-label="Filter by category"
            className="w-44"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
            <option value="AUTHENTICATION">Authentication</option>
          </Select>
        }
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        tone="danger"
        title="Delete this template?"
        description={
          deleteTarget
            ? `“${deleteTarget.displayName}” will be removed permanently. Campaigns already sent with it are unaffected.`
            : undefined
        }
        confirmLabel="Delete template"
        onConfirm={() => {
          if (deleteTarget) runAction(deleteTemplateAction, deleteTarget.id);
        }}
      />
    </>
  );
}

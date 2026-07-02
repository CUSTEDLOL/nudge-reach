"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { TagPill } from "@/components/ui/tag-pill";
import { useToast } from "@/components/ui/toast";
import { canSendMarketing } from "@/lib/consent";
import {
  bulkAddTag,
  bulkAddToAudience,
  bulkSetStage,
  type ActionResult,
} from "./actions";
import {
  formatDate,
  sourceLabel,
  STAGE_LABEL,
  STAGE_TONE,
  STAGES,
  type AudienceRow,
  type ContactRow,
  type MemberOption,
  type TagInfo,
} from "./types";

const FILTER_KEYS = ["stage", "tag", "optin", "assignee", "q"] as const;

function ConsentBadge({ contact }: { contact: ContactRow }) {
  if (canSendMarketing({ optedIn: contact.optedIn, optedOutAt: contact.optedOutAt ? new Date(contact.optedOutAt) : null })) {
    return <Badge tone="success">Opted in</Badge>;
  }
  if (contact.optedOutAt) return <Badge tone="danger">Opted out</Badge>;
  return <Badge tone="neutral">No consent</Badge>;
}

export function ContactsTable({
  rows,
  tags,
  members,
  audiences,
}: {
  rows: ContactRow[];
  tags: TagInfo[];
  members: MemberOption[];
  audiences: AudienceRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [bulkStage, setBulkStage] = useState("");
  const [bulkAudience, setBulkAudience] = useState("");
  const [pending, startTransition] = useTransition();

  const memberName = useCallback(
    (userId: string | null) =>
      members.find((m) => m.userId === userId)?.name ?? null,
    [members]
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const activeQ = searchParams.get("q") ?? "";
  const hasFilters = FILTER_KEYS.some((k) => searchParams.get(k));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function runBulk(
    action: (fd: FormData) => Promise<ActionResult>,
    extra: Record<string, string>
  ) {
    const fd = new FormData();
    selected.forEach((id) => fd.append("contactIds", id));
    for (const [key, value] of Object.entries(extra)) fd.set(key, value);
    startTransition(async () => {
      const res = await action(fd);
      toast({ description: res.message, tone: res.ok ? "success" : "error" });
      if (res.ok) setSelected(new Set());
    });
  }

  const columns: DataTableColumn<ContactRow>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          aria-label="Select all contacts"
          checked={allSelected}
          onChange={() =>
            setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
          }
          className="h-3.5 w-3.5 accent-brand-600"
        />
      ),
      cell: (row) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.name}`}
          checked={selected.has(row.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggle(row.id)}
          className="h-3.5 w-3.5 accent-brand-600"
        />
      ),
      className: "w-8 pr-0",
    },
    {
      key: "name",
      header: "Name",
      sortValue: (row) => row.name,
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={row.name} size="sm" />
          <Link
            href={`/contacts/${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-neutral-800 hover:text-brand-700 hover:underline"
          >
            {row.name}
          </Link>
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      cell: (row) => (
        <span className="font-mono text-xs text-neutral-500">
          {row.phoneE164}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (row) =>
        row.email ? (
          <span className="text-neutral-600">{row.email}</span>
        ) : (
          <span className="text-neutral-300">—</span>
        ),
    },
    {
      key: "tags",
      header: "Tags",
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1">
          {row.tags.slice(0, 3).map((t) => (
            <TagPill key={t.id} label={t.name} color={t.color} />
          ))}
          {row.tags.length > 3 && (
            <span className="text-xs text-neutral-400">
              +{row.tags.length - 3}
            </span>
          )}
          {row.tags.length === 0 && <span className="text-neutral-300">—</span>}
        </span>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      sortValue: (row) => row.leadStage,
      cell: (row) => (
        <Badge tone={STAGE_TONE[row.leadStage]}>
          {STAGE_LABEL[row.leadStage]}
        </Badge>
      ),
    },
    {
      key: "assignee",
      header: "Assignee",
      cell: (row) => {
        const name = memberName(row.assignedToUserId);
        return name ? (
          <span className="flex items-center gap-1.5 text-neutral-600">
            <Avatar name={name} size="sm" className="h-5 w-5 text-[9px]" />
            {name}
          </span>
        ) : (
          <span className="text-neutral-300">—</span>
        );
      },
    },
    {
      key: "source",
      header: "Source",
      cell: (row) => (
        <span className="text-xs text-neutral-500">
          {sourceLabel(row.optInSource)}
        </span>
      ),
    },
    {
      key: "optin",
      header: "Opt-in",
      sortValue: (row) => (canSendMarketing({ optedIn: row.optedIn, optedOutAt: row.optedOutAt ? new Date(row.optedOutAt) : null }) ? 1 : 0),
      cell: (row) => <ConsentBadge contact={row} />,
    },
    {
      key: "lastContacted",
      header: "Last contacted",
      sortValue: (row) =>
        row.lastContactedAt ? new Date(row.lastContactedAt) : null,
      cell: (row) => (
        <span className="text-xs text-neutral-500">
          {formatDate(row.lastContactedAt)}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      sortValue: (row) => new Date(row.createdAt),
      cell: (row) => (
        <span className="text-xs text-neutral-500">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
  ];

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Filter by stage"
        value={searchParams.get("stage") ?? ""}
        onChange={(e) => setFilter("stage", e.target.value)}
        className="w-36"
      >
        <option value="">All stages</option>
        {STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by tag"
        value={searchParams.get("tag") ?? ""}
        onChange={(e) => setFilter("tag", e.target.value)}
        className="w-36"
      >
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by opt-in"
        value={searchParams.get("optin") ?? ""}
        onChange={(e) => setFilter("optin", e.target.value)}
        className="w-36"
      >
        <option value="">Any consent</option>
        <option value="yes">Opted in</option>
        <option value="no">Not opted in</option>
      </Select>
      <Select
        aria-label="Filter by assignee"
        value={searchParams.get("assignee") ?? ""}
        onChange={(e) => setFilter("assignee", e.target.value)}
        className="w-40"
      >
        <option value="">Any assignee</option>
        <option value="unassigned">Unassigned</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </Select>
      {activeQ && (
        <Badge tone="brand" className="gap-1">
          Search: “{activeQ}”
          <button
            type="button"
            onClick={() => setFilter("q", "")}
            aria-label="Clear search"
            className="-mr-0.5 rounded-full p-0.5 outline-none transition-colors duration-150 hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-brand-400/50"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </Badge>
      )}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        searchValue={(row) =>
          `${row.name} ${row.phoneE164} ${row.email ?? ""} ${row.tags
            .map((t) => t.name)
            .join(" ")}`
        }
        searchPlaceholder="Filter results…"
        toolbar={filterBar}
        pageSize={15}
        initialSort={{ key: "created", dir: "desc" }}
        onRowClick={(row) => router.push(`/contacts/${row.id}`)}
        emptyMessage={
          hasFilters
            ? "No contacts match these filters."
            : "No contacts yet — add one to get started."
        }
      />

      {selected.size > 0 && (
        // Sits above the mobile bottom nav; back to bottom-4 on desktop.
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mt-4 flex justify-center lg:bottom-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-black/5 bg-white px-4 py-2.5 shadow-lift">
            <span className="text-sm font-medium text-neutral-800">
              {selected.size} selected
            </span>
            <span className="mx-1 hidden h-5 w-px bg-neutral-200 sm:block" aria-hidden />
            <Select
              aria-label="Bulk: pick a tag"
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              className="w-32"
            >
              <option value="">Tag…</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!bulkTag || pending}
              onClick={() => runBulk(bulkAddTag, { tagId: bulkTag })}
            >
              Add tag
            </Button>
            <Select
              aria-label="Bulk: pick a stage"
              value={bulkStage}
              onChange={(e) => setBulkStage(e.target.value)}
              className="w-32"
            >
              <option value="">Stage…</option>
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!bulkStage || pending}
              onClick={() => runBulk(bulkSetStage, { leadStage: bulkStage })}
            >
              Set stage
            </Button>
            <Select
              aria-label="Bulk: pick an audience"
              value={bulkAudience}
              onChange={(e) => setBulkAudience(e.target.value)}
              className="w-36"
            >
              <option value="">Audience…</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!bulkAudience || pending}
              onClick={() =>
                runBulk(bulkAddToAudience, { audienceId: bulkAudience })
              }
            >
              Add to audience
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
              className="ml-1 rounded-lg p-1.5 text-neutral-400 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-brand-400/50"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

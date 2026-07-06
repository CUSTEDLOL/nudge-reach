"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  align?: "left" | "right";
  className?: string;
};

type SortState = { key: string; dir: "asc" | "desc" };

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

/**
 * Client table with search, sort and pagination. Because columns contain
 * functions, DataTable must be rendered FROM a client component (module
 * pages wrap it in a small "use client" list component).
 *
 * Below the `sm` breakpoint rows render as stacked cards: the first
 * string-headed column becomes the card title, remaining string-headed
 * columns become label/value pairs, and unlabeled columns (checkboxes,
 * action menus) sit in the card's header row. Call sites need no changes.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchValue,
  searchPlaceholder = "Search…",
  pageSize = 10,
  emptyMessage = "Nothing here yet.",
  initialSort,
  onRowClick,
  toolbar,
  className,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Enables the search box; return the haystack for a row. */
  searchValue?: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: ReactNode;
  initialSort?: SortState;
  onRowClick?: (row: T) => void;
  /** Extra controls rendered beside the search box (filters, actions). */
  toolbar?: ReactNode;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchValue) return rows;
    return rows.filter((row) => searchValue(row).toLowerCase().includes(q));
  }, [rows, query, searchValue]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort(
      (a, b) => compare(col.sortValue!(a), col.sortValue!(b)) * dir
    );
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const from = sorted.length === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(sorted.length, (safePage + 1) * pageSize);

  function toggleSort(key: string) {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  // Mobile card layout: partition the columns once per render.
  const firstLabeled = columns.findIndex((c) => typeof c.header === "string");
  const leadIndex = firstLabeled >= 0 ? firstLabeled : 0;
  const lead = columns[leadIndex];
  const chromeBefore = columns.filter(
    (c, i) => i < leadIndex && typeof c.header !== "string"
  );
  const chromeAfter = columns.filter(
    (c, i) => i > leadIndex && typeof c.header !== "string"
  );
  const detailCols = columns.filter(
    (c, i) => i !== leadIndex && typeof c.header === "string"
  );
  const sortableCols = columns.filter(
    (c) => c.sortValue && typeof c.header === "string"
  );

  return (
    <div className={className}>
      {(searchValue || toolbar || sortableCols.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {searchValue && (
            <div className="relative w-full max-w-xs">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="pl-8"
              />
            </div>
          )}
          {toolbar}
          {sortableCols.length > 0 && (
            <Select
              aria-label="Sort by"
              value={sort ? `${sort.key}:${sort.dir}` : ""}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                setSort(key ? { key, dir: dir as "asc" | "desc" } : null);
              }}
              className="w-[calc(50%-0.25rem)] sm:hidden"
            >
              <option value="">Sort…</option>
              {sortableCols.flatMap((col) => [
                <option key={`${col.key}:asc`} value={`${col.key}:asc`}>
                  {String(col.header)} ↑
                </option>,
                <option key={`${col.key}:desc`} value={`${col.key}:desc`}>
                  {String(col.header)} ↓
                </option>,
              ])}
            </Select>
          )}
        </div>
      )}

      {/* Mobile: stacked cards */}
      <div className="sm:hidden">
        {paged.length === 0 ? (
          <div className="rounded-2xl border border-black/5 bg-white px-6 py-10 text-center text-sm text-neutral-500 shadow-soft">
            {emptyMessage}
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {paged.map((row) => (
              <li key={rowKey(row)}>
                <div
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter") onRowClick(row);
                        }
                      : undefined
                  }
                  className={cn(
                    "rounded-2xl border border-black/5 bg-white p-4 shadow-soft outline-none",
                    onRowClick &&
                      "cursor-pointer transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-400/50 active:bg-neutral-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {chromeBefore.map((col) => (
                      <div key={col.key} className="shrink-0 pt-0.5">
                        {col.cell(row)}
                      </div>
                    ))}
                    <div className="min-w-0 flex-1 text-sm">{lead.cell(row)}</div>
                    {chromeAfter.map((col) => (
                      <div key={col.key} className="shrink-0">
                        {col.cell(row)}
                      </div>
                    ))}
                  </div>
                  {detailCols.length > 0 && (
                    <dl className="mt-3 grid grid-cols-[minmax(5rem,max-content)_1fr] items-baseline gap-x-4 gap-y-1.5 border-t border-neutral-100 pt-3 text-sm">
                      {detailCols.map((col) => (
                        <Fragment key={col.key}>
                          <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                            {col.header}
                          </dt>
                          <dd className="min-w-0 break-words text-neutral-700">
                            {col.cell(row)}
                          </dd>
                        </Fragment>
                      ))}
                    </dl>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Desktop / tablet: classic table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-soft sm:block">
        <Table>
          <TableHeader>
            <TableRow className="border-t-0 hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(col.align === "right" && "text-right", col.className)}
                  aria-sort={
                    sort?.key === col.key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 rounded outline-none transition-colors duration-150 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-brand-400/50"
                    >
                      {col.header}
                      {sort?.key === col.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3 w-3" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center text-sm text-neutral-500"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(col.align === "right" && "text-right", col.className)}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {sorted.length > pageSize && (
        <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
          <span>
            Showing {from}–{to} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className="rounded-lg border border-neutral-200 bg-white p-2.5 outline-none transition-colors duration-150 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:pointer-events-none disabled:opacity-50 sm:p-1.5"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="px-2">
              Page {safePage + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
              className="rounded-lg border border-neutral-200 bg-white p-2.5 outline-none transition-colors duration-150 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:pointer-events-none disabled:opacity-50 sm:p-1.5"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

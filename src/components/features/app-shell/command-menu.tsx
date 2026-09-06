"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMounted, useOverlay } from "@/components/ui/overlay";
import {
  commandsForRole,
  type AppCommand,
  type AppRole,
} from "@/components/features/app-shell/nav";

const GROUPS: readonly AppCommand["group"][] = ["Navigate", "Quick actions"];

export function CommandMenu({ role }: { role: AppRole }) {
  const router = useRouter();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(open, () => setOpen(false), panelRef);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const commands = useMemo(() => commandsForRole(role), [role]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) =>
      [command.label, ...command.keywords]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [commands, query]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function searchLeads() {
    const value = query.trim();
    close();
    router.push(value ? `/contacts?q=${encodeURIComponent(value)}` : "/contacts");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500 outline-none transition-colors hover:border-neutral-300 hover:bg-white hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-brand-500 sm:w-full sm:max-w-md sm:justify-start sm:px-3"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="sr-only sm:not-sr-only sm:ml-2 sm:truncate sm:text-sm">
          Search or jump to...
        </span>
        <kbd className="ml-auto hidden rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-neutral-400 md:inline-flex">
          ⌘K
        </kbd>
      </button>

      {mounted && open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]">
            <button
              type="button"
              aria-label="Close search"
              onClick={close}
              className="absolute inset-0 cursor-default bg-neutral-950/40"
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Search or jump to"
              tabIndex={-1}
              className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lift outline-none"
            >
              <div className="flex items-center gap-3 border-b border-neutral-200 px-4">
                <Search className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a page or action"
                  aria-label="Find a page or action"
                  className="h-14 min-w-0 flex-1 bg-transparent text-base text-neutral-950 outline-none placeholder:text-neutral-400"
                />
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close search"
                  className="grid h-10 w-10 place-items-center rounded-lg text-neutral-400 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="max-h-[min(60vh,32rem)] overflow-y-auto p-2">
                {GROUPS.map((group) => {
                  const items = filtered.filter((command) => command.group === group);
                  if (items.length === 0) return null;
                  return (
                    <section key={group} aria-labelledby={`command-${group}`}>
                      <h2
                        id={`command-${group}`}
                        className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400"
                      >
                        {group}
                      </h2>
                      <ul>
                        {items.map((command) => (
                          <li key={`${group}-${command.href}`}>
                            <Link
                              href={command.href}
                              onClick={close}
                              className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-neutral-700 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:bg-brand-50 focus-visible:text-brand-800"
                            >
                              <command.icon
                                className="h-[18px] w-[18px] shrink-0 text-neutral-400"
                                aria-hidden
                              />
                              {command.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}

                {query.trim() && (
                  <button
                    type="button"
                    onClick={searchLeads}
                    className={cn(
                      "mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl border-t border-neutral-100 px-3 py-3 text-left text-sm font-medium outline-none transition-colors hover:bg-brand-50 focus-visible:bg-brand-50",
                      filtered.length === 0 ? "text-brand-800" : "text-neutral-700"
                    )}
                  >
                    <Search className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">
                      Search leads for “{query.trim()}”
                    </span>
                  </button>
                )}

                {filtered.length === 0 && !query.trim() && (
                  <p className="px-3 py-10 text-center text-sm text-neutral-500">
                    Start typing to find a page or action.
                  </p>
                )}
              </div>
              <p className="border-t border-neutral-100 px-4 py-2 text-xs text-neutral-400">
                Navigate Nudge or search your leads. Conversation search stays in Inbox.
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

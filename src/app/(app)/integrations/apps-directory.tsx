"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ExternalLink, Lock, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  APP_CATEGORIES,
  countConnected,
  matchesQuery,
  sortTiles,
  type AppCategoryId,
  type AppTile,
  type PanelKey,
} from "@/modules/integrations/catalog";
import { AppIcon } from "./app-icon";
import { recipeFor } from "./bridge-recipes";

/**
 * The app directory. One searchable grid instead of six stacked cards, so a
 * client can see everything Nudge talks to and switch one on without being
 * told where to look. Every tile carries exactly one action.
 *
 * The panels (calendar, CRM, webhooks, API keys) are rendered on the server
 * and passed in, so this file stays presentation and the existing, tested
 * cards keep owning their own behaviour.
 */

type Filter = "all" | AppCategoryId;

export function AppsDirectory({
  tiles,
  panels,
}: {
  tiles: AppTile[];
  panels: Partial<Record<PanelKey, ReactNode>>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const [bridgeApp, setBridgeApp] = useState<AppTile | null>(null);

  const connectedCount = countConnected(tiles);

  const visible = useMemo(() => {
    const byCategory =
      filter === "all" ? tiles : tiles.filter((t) => t.category === filter);
    return sortTiles(byCategory.filter((t) => matchesQuery(t, query)));
  }, [tiles, filter, query]);

  // Only offer a category chip when something in it survives the search.
  const availableCategories = useMemo(() => {
    const matched = tiles.filter((t) => matchesQuery(t, query));
    return APP_CATEGORIES.filter((c) =>
      matched.some((t) => t.category === c.id)
    );
  }, [tiles, query]);

  function openTile(tile: AppTile) {
    if (!tile.action?.panel) return;
    if (tile.action.panel === "bridge") {
      setBridgeApp(tile);
      return;
    }
    setOpenPanel(tile.action.panel);
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* search + categories */}
      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search apps…"
            aria-label="Search apps"
            className="h-11 pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <CategoryChip
            label="All"
            count={tiles.filter((t) => matchesQuery(t, query)).length}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          {availableCategories.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.label}
              active={filter === category.id}
              onClick={() => setFilter(category.id)}
            />
          ))}
        </div>
      </div>

      {connectedCount > 0 && filter === "all" && !query && (
        <p className="text-sm text-neutral-500">
          <span className="font-semibold text-neutral-900">
            {connectedCount} connected
          </span>{" "}
          · {tiles.length - connectedCount} more available
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-neutral-900">
            No app matches “{query}”
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Anything with a webhook can still connect — try the Zapier tile.
          </p>
        </div>
      ) : (
        <ul className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((tile) => (
            <AppCard key={tile.id} tile={tile} onOpen={() => openTile(tile)} />
          ))}
        </ul>
      )}

      {/* server-rendered panels, opened from a tile */}
      {(["whatsapp", "calendar", "crm", "webhooks", "api", "payments"] as PanelKey[]).map(
        (key) =>
          panels[key] ? (
            <Drawer
              key={key}
              open={openPanel === key}
              onClose={() => setOpenPanel(null)}
              title={PANEL_TITLES[key]}
              description={PANEL_DESCRIPTIONS[key]}
              width="lg"
            >
              {panels[key]}
            </Drawer>
          ) : null
      )}

      <BridgeDrawer
        tile={bridgeApp}
        onClose={() => setBridgeApp(null)}
        onOpenWebhooks={() => {
          setBridgeApp(null);
          setOpenPanel("webhooks");
        }}
      />

    </div>
  );
}


const PANEL_TITLES: Record<PanelKey, string> = {
  whatsapp: "WhatsApp Business",
  calendar: "Google Calendar",
  crm: "CRM sync",
  webhooks: "Outbound webhooks",
  api: "API keys",
  bridge: "Connect with a webhook",
  payments: "Payments",
};

const PANEL_DESCRIPTIONS: Record<PanelKey, string> = {
  whatsapp: "Your own number, on Meta's official Cloud API.",
  calendar: "Let the AI book into your real availability.",
  crm: "Every lead, booking and payment, written into your CRM.",
  webhooks: "Signed, real-time events sent to your own endpoints.",
  api: "Programmatic access to this workspace.",
  bridge: "Three steps, then it runs on its own.",
  payments: "How the AI collects deposits inside a chat.",
};

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium outline-none transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-brand-400/60",
        active
          ? "bg-neutral-900 text-white"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
      )}
    >
      {label}
      {count !== undefined && (
        <span className={active ? "text-white/60" : "text-neutral-400"}>
          {count}
        </span>
      )}
    </button>
  );
}

function AppCard({ tile, onOpen }: { tile: AppTile; onOpen: () => void }) {
  const action = tile.action;
  return (
    <li
      className={cn(
        "group flex min-w-0 flex-col rounded-2xl border bg-white p-4 transition-shadow duration-150",
        tile.status === "connected"
          ? "border-brand-200 shadow-[0_1px_2px_rgba(10,31,26,0.05)]"
          : "border-neutral-200 hover:shadow-[0_2px_10px_rgba(10,31,26,0.07)]",
        tile.status === "planned" && "opacity-70"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <AppIcon icon={tile.icon} accent={tile.accent} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-neutral-950">
            {tile.name}
          </p>
          <p className="mt-0.5 text-sm leading-snug text-neutral-500">
            {tile.tagline}
          </p>
        </div>
      </div>

      {tile.detail && (
        <p className="mt-2.5 truncate text-xs text-neutral-500" title={tile.detail}>
          {tile.detail}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <StatusPill tile={tile} />
        {action ? (
          action.href ? (
            <Link
              href={action.href}
              className={buttonVariants({
                variant: tile.status === "connected" ? "secondary" : "primary",
                size: "sm",
              })}
            >
              {action.label}
              {tile.status === "locked" && (
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              )}
            </Link>
          ) : (
            <Button
              size="sm"
              variant={tile.status === "connected" ? "secondary" : "primary"}
              onClick={onOpen}
            >
              {action.label}
            </Button>
          )
        ) : null}
      </div>
    </li>
  );
}

function StatusPill({ tile }: { tile: AppTile }) {
  if (tile.status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700">
        <Check className="h-3.5 w-3.5" aria-hidden />
        {tile.statusLabel}
      </span>
    );
  }
  if (tile.status === "locked") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <Lock className="h-3.5 w-3.5" aria-hidden />
        {tile.statusLabel}
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-neutral-500">
      {tile.statusLabel}
    </span>
  );
}

function BridgeDrawer({
  tile,
  onClose,
  onOpenWebhooks,
}: {
  tile: AppTile | null;
  onClose: () => void;
  onOpenWebhooks: () => void;
}) {
  if (!tile) return null;
  const recipe = recipeFor(tile.id);
  return (
    <Drawer
      open
      onClose={onClose}
      title={`Connect ${tile.name}`}
      description={tile.tagline}
      width="lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onOpenWebhooks}>Add the endpoint</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-xl bg-sky-50 px-4 py-3">
          <AppIcon icon={tile.icon} accent={tile.accent} className="h-9 w-9" />
          <p className="text-sm leading-relaxed text-sky-900">
            {tile.name} connects through an outbound webhook. Nothing to install
            — you paste one URL and pick which events should reach it.
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {recipe.steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span className="text-sm leading-relaxed text-neutral-700">
                {step}
              </span>
            </li>
          ))}
        </ol>

        {recipe.docs && (
          <a
            href={recipe.docs.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            {recipe.docs.label}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>
    </Drawer>
  );
}

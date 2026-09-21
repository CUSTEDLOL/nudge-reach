/**
 * The app directory: what a workspace can connect, and what each one is doing
 * right now. Pure — the page passes in the workspace's real state and gets
 * back tiles ready to render, so the copy and the status rules are unit
 * tested instead of buried in JSX.
 *
 * Honesty rule (AGENTS.md): a tile never implies more than we built.
 *  - `native`  we built the connection; one click does it.
 *  - `bridge`  it genuinely works today, through an outbound webhook or the
 *              REST API. The drawer says exactly how.
 *  - `planned` not built. No button, always labelled "Coming soon".
 */

export type AppKind = "native" | "bridge" | "planned";

export type AppStatus =
  | "connected" // live for this workspace
  | "ready" // can be switched on right now
  | "locked" // real, but the plan does not include it
  | "planned"; // not built yet

export type AppCategoryId =
  | "essentials"
  | "calendar"
  | "crm"
  | "automation"
  | "payments"
  | "developer"
  | "channels";

export interface AppCategory {
  id: AppCategoryId;
  label: string;
}

export const APP_CATEGORIES: AppCategory[] = [
  { id: "essentials", label: "Essentials" },
  { id: "calendar", label: "Calendar" },
  { id: "crm", label: "CRM" },
  { id: "automation", label: "Automation" },
  { id: "payments", label: "Payments" },
  { id: "developer", label: "Developer" },
  { id: "channels", label: "Channels" },
];

/** Which panel a tile opens. `null` means the action is a plain link. */
export type PanelKey =
  | "whatsapp"
  | "calendar"
  | "crm"
  | "webhooks"
  | "api"
  | "bridge"
  | "payments";

export interface AppDefinition {
  id: string;
  name: string;
  /** One line. Written for the business owner, not the developer. */
  tagline: string;
  category: AppCategoryId;
  kind: AppKind;
  /** Icon key — mapped to a lucide icon in `app-icon.tsx`. */
  icon: string;
  /** Tailwind classes for the tinted icon square. */
  accent: string;
  /** Extra words people might search for. */
  keywords?: string[];
}

export interface AppAction {
  label: string;
  /** Navigate here (internal route or OAuth start). */
  href?: string;
  /** Or open this panel in a drawer. */
  panel?: PanelKey;
}

export interface AppTile extends AppDefinition {
  status: AppStatus;
  /** The pill under the tile: "Connected", "Not connected", "Coming soon"… */
  statusLabel: string;
  /** A second line shown only when we know something concrete. */
  detail: string | null;
  /** The button. `null` for planned apps, which are deliberately inert. */
  action: AppAction | null;
}

/** Everything the catalog needs to know about one workspace. */
export interface CatalogState {
  whatsappConnected: boolean;
  whatsappName: string | null;
  simulation: boolean;
  calendarConnected: boolean;
  calendarEmail: string | null;
  calendarSimulated: boolean;
  zohoConnected: boolean;
  salesforceConnected: boolean;
  webhookCount: number;
  apiKeyCount: number;
  widgetEnabled: boolean;
  /** Bookings, payment links and CRM sync live on the AI Front Desk plans. */
  hasFrontDesk: boolean;
  /** API keys and webhooks are a Growth-and-up entitlement. */
  hasPublicApi: boolean;
  /** Payment links are configured platform-side and this org's plan allows them. */
  paymentsLive: boolean;
}

const UPGRADE_HREF = "/settings/billing";

export const APPS: AppDefinition[] = [
  // ---- Essentials -------------------------------------------------------
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    tagline: "Your own number, on Meta's official Cloud API.",
    category: "essentials",
    kind: "native",
    icon: "whatsapp",
    accent: "bg-emerald-50 text-emerald-600",
    keywords: ["meta", "cloud api", "number", "chat"],
  },
  {
    id: "website-button",
    name: "Website chat button",
    tagline: "A button on your site that opens a WhatsApp chat.",
    category: "essentials",
    kind: "native",
    icon: "globe",
    accent: "bg-sky-50 text-sky-600",
    keywords: ["widget", "site", "web", "embed"],
  },
  // ---- Calendar ---------------------------------------------------------
  {
    id: "google-calendar",
    name: "Google Calendar",
    tagline: "The AI books real appointments around your availability.",
    category: "calendar",
    kind: "native",
    icon: "calendar",
    accent: "bg-blue-50 text-blue-600",
    keywords: ["booking", "appointments", "availability", "gcal"],
  },
  // ---- CRM --------------------------------------------------------------
  {
    id: "zoho",
    name: "Zoho CRM",
    tagline: "Every lead, booking and payment written into Zoho.",
    category: "crm",
    kind: "native",
    icon: "database",
    accent: "bg-red-50 text-red-600",
    keywords: ["crm", "leads", "sync"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    tagline: "Leads and follow-up tasks created for your reps.",
    category: "crm",
    kind: "native",
    icon: "cloud",
    accent: "bg-sky-50 text-sky-600",
    keywords: ["crm", "leads", "sync", "sfdc"],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    tagline: "Send new leads to HubSpot as they come in.",
    category: "crm",
    kind: "bridge",
    icon: "target",
    accent: "bg-orange-50 text-orange-600",
    keywords: ["crm", "leads"],
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    tagline: "Create a Pipedrive deal from every qualified lead.",
    category: "crm",
    kind: "bridge",
    icon: "trending",
    accent: "bg-emerald-50 text-emerald-600",
    keywords: ["crm", "deals", "pipeline"],
  },
  // ---- Automation -------------------------------------------------------
  {
    id: "zapier",
    name: "Zapier",
    tagline: "Push Nudge events into 8,000+ other apps.",
    category: "automation",
    kind: "bridge",
    icon: "zap",
    accent: "bg-orange-50 text-orange-600",
    keywords: ["automation", "zap", "no-code"],
  },
  {
    id: "make",
    name: "Make",
    tagline: "Build visual scenarios that react to your customers.",
    category: "automation",
    kind: "bridge",
    icon: "workflow",
    accent: "bg-violet-50 text-violet-600",
    keywords: ["integromat", "automation", "no-code"],
  },
  {
    id: "n8n",
    name: "n8n",
    tagline: "Self-hosted workflows, triggered by Nudge.",
    category: "automation",
    kind: "bridge",
    icon: "branch",
    accent: "bg-rose-50 text-rose-600",
    keywords: ["automation", "self hosted", "workflow"],
  },
  {
    id: "slack",
    name: "Slack",
    tagline: "Ping your team when a customer needs a person.",
    category: "automation",
    kind: "bridge",
    icon: "bell",
    accent: "bg-violet-50 text-violet-600",
    keywords: ["notifications", "team", "alerts"],
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    tagline: "Log every lead to a spreadsheet row.",
    category: "automation",
    kind: "bridge",
    icon: "table",
    accent: "bg-emerald-50 text-emerald-600",
    keywords: ["spreadsheet", "export", "log"],
  },
  // ---- Payments ---------------------------------------------------------
  {
    id: "razorpay",
    name: "Razorpay",
    tagline: "UPI and card links the AI sends inside the chat.",
    category: "payments",
    kind: "native",
    icon: "rupee",
    accent: "bg-blue-50 text-blue-600",
    keywords: ["upi", "deposit", "payment link", "india"],
  },
  {
    id: "stripe",
    name: "Stripe",
    tagline: "Card payment links for customers outside India.",
    category: "payments",
    kind: "native",
    icon: "card",
    accent: "bg-violet-50 text-violet-600",
    keywords: ["card", "payment link", "international"],
  },
  // ---- Developer --------------------------------------------------------
  {
    id: "webhooks",
    name: "Outbound webhooks",
    tagline: "Signed, real-time events sent to your own endpoint.",
    category: "developer",
    kind: "native",
    icon: "webhook",
    accent: "bg-neutral-100 text-neutral-600",
    keywords: ["events", "http", "developer", "callback"],
  },
  {
    id: "rest-api",
    name: "REST API",
    tagline: "Read and write your workspace from your own code.",
    category: "developer",
    kind: "native",
    icon: "code",
    accent: "bg-neutral-100 text-neutral-600",
    keywords: ["api key", "developer", "rest"],
  },
  // ---- Channels (not built) --------------------------------------------
  {
    id: "shopify",
    name: "Shopify",
    tagline: "Order and customer sync, without a webhook in between.",
    category: "channels",
    kind: "planned",
    icon: "bag",
    accent: "bg-emerald-50 text-emerald-600",
    keywords: ["store", "ecommerce", "orders"],
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    tagline: "The same order sync for WordPress stores.",
    category: "channels",
    kind: "planned",
    icon: "cart",
    accent: "bg-violet-50 text-violet-600",
    keywords: ["store", "ecommerce", "wordpress"],
  },
  {
    id: "instagram",
    name: "Instagram DMs",
    tagline: "The same AI answering your Instagram messages.",
    category: "channels",
    kind: "planned",
    icon: "camera",
    accent: "bg-pink-50 text-pink-600",
    keywords: ["dm", "social", "meta"],
  },
  {
    id: "messenger",
    name: "Facebook Messenger",
    tagline: "The same AI answering your Page messages.",
    category: "channels",
    kind: "planned",
    icon: "messages",
    accent: "bg-blue-50 text-blue-600",
    keywords: ["dm", "social", "meta", "page"],
  },
];

/** The tiles, in the order they should be shown, for one workspace. */
export function buildAppCatalog(state: CatalogState): AppTile[] {
  return APPS.map((app) => decorate(app, state));
}

function decorate(app: AppDefinition, s: CatalogState): AppTile {
  switch (app.id) {
    case "whatsapp":
      return tile(app, {
        status: s.whatsappConnected ? "connected" : "ready",
        statusLabel: s.whatsappConnected
          ? "Connected"
          : s.simulation
            ? "Test mode"
            : "Not connected",
        detail: s.whatsappConnected
          ? `Sending as “${s.whatsappName ?? "your number"}”`
          : s.simulation
            ? "Replies are mocked until your number is live."
            : null,
        action: {
          label: s.whatsappConnected ? "Manage" : "Connect",
          panel: "whatsapp",
        },
      });

    case "website-button":
      return tile(app, {
        status: s.widgetEnabled ? "connected" : "ready",
        statusLabel: s.widgetEnabled ? "Live on your site" : "Not set up",
        detail: null,
        action: {
          label: s.widgetEnabled ? "Manage" : "Set up",
          href: "/settings/widget",
        },
      });

    case "google-calendar":
      if (!s.hasFrontDesk) return gated(app, "Books appointments on Growth and above.");
      return tile(app, {
        status: s.calendarConnected ? "connected" : "ready",
        statusLabel: s.calendarConnected
          ? s.calendarSimulated
            ? "Test calendar"
            : "Connected"
          : "Not connected",
        detail: s.calendarConnected
          ? s.calendarSimulated
            ? "Test calendar — practice bookings only, nothing reaches a real calendar."
            : (s.calendarEmail ?? "Google account linked")
          : null,
        action: {
          label: s.calendarConnected ? "Manage" : "Connect",
          panel: "calendar",
        },
      });

    case "zoho":
    case "salesforce": {
      if (!s.hasFrontDesk) return gated(app, "CRM sync is on Growth and above.");
      const connected = app.id === "zoho" ? s.zohoConnected : s.salesforceConnected;
      return tile(app, {
        status: connected ? "connected" : "ready",
        statusLabel: connected ? "Connected" : "Not connected",
        detail: connected ? "Leads and bookings are syncing." : null,
        action: { label: connected ? "Manage" : "Connect", panel: "crm" },
      });
    }

    case "razorpay":
    case "stripe":
      if (!s.hasFrontDesk) return gated(app, "Payment links are on Growth and above.");
      return tile(app, {
        status: s.paymentsLive ? "connected" : "ready",
        statusLabel: s.paymentsLive ? "Active" : s.simulation ? "Test links" : "Not switched on yet",
        detail: s.paymentsLive
          ? "The AI can collect deposits in chat."
          : s.simulation
            ? "Links are simulated until we switch on live payments."
            : "No links are sent until we enable live payments; the AI says your team will share payment details.",
        action: { label: "How it works", panel: "payments" },
      });

    case "webhooks":
      if (!s.hasPublicApi) return gated(app, "Webhooks are on Growth and above.");
      return tile(app, {
        status: s.webhookCount > 0 ? "connected" : "ready",
        statusLabel:
          s.webhookCount > 0
            ? `${s.webhookCount} endpoint${s.webhookCount === 1 ? "" : "s"}`
            : "Not set up",
        detail: null,
        action: { label: s.webhookCount > 0 ? "Manage" : "Add endpoint", panel: "webhooks" },
      });

    case "rest-api":
      if (!s.hasPublicApi) return gated(app, "The API is on Growth and above.");
      return tile(app, {
        status: s.apiKeyCount > 0 ? "connected" : "ready",
        statusLabel:
          s.apiKeyCount > 0
            ? `${s.apiKeyCount} key${s.apiKeyCount === 1 ? "" : "s"}`
            : "No keys yet",
        detail: null,
        action: { label: s.apiKeyCount > 0 ? "Manage" : "Create key", panel: "api" },
      });

    default:
      break;
  }

  if (app.kind === "planned") {
    return tile(app, {
      status: "planned",
      statusLabel: "Coming soon",
      detail: null,
      action: null,
    });
  }

  // Everything else is a bridge app: it works today through a webhook.
  if (!s.hasPublicApi) return gated(app, "Needs webhooks, which start on Growth.");
  return tile(app, {
    status: "ready",
    statusLabel: "Connect with a webhook",
    detail: null,
    action: { label: "Set up", panel: "bridge" },
  });
}

function tile(
  app: AppDefinition,
  rest: Pick<AppTile, "status" | "statusLabel" | "detail" | "action">
): AppTile {
  return { ...app, ...rest };
}

function gated(app: AppDefinition, why: string): AppTile {
  return tile(app, {
    status: "locked",
    statusLabel: "Not on your plan",
    detail: why,
    action: { label: "See plans", href: UPGRADE_HREF },
  });
}

/** Free-text search across name, tagline and keywords. */
export function matchesQuery(app: AppTile, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const haystack = [app.name, app.tagline, ...(app.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/** Connected first, then ready, then locked, then planned. Stable within a group. */
const STATUS_RANK: Record<AppStatus, number> = {
  connected: 0,
  ready: 1,
  locked: 2,
  planned: 3,
};

export function sortTiles(tiles: AppTile[]): AppTile[] {
  return [...tiles].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]
  );
}

export function countConnected(tiles: AppTile[]): number {
  return tiles.filter((t) => t.status === "connected").length;
}

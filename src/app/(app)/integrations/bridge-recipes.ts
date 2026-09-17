/**
 * Bridge apps connect through an outbound webhook, so each one needs the two
 * or three steps that are specific to it. Kept as data (and unit tested) so
 * the drawer stays a renderer.
 */

export interface BridgeRecipe {
  /** Where they get a URL to paste into Nudge. */
  steps: string[];
  /** The events we suggest ticking for this app. */
  suggestedEvents: string[];
  /** Deep link to the other product's docs, when there is an obvious one. */
  docs?: { label: string; href: string };
}

const CATCH_HOOK = "message.received";

export const BRIDGE_RECIPES: Record<string, BridgeRecipe> = {
  zapier: {
    steps: [
      "In Zapier, start a new Zap and choose the “Webhooks by Zapier” trigger, event “Catch Hook”.",
      "Zapier shows you a custom webhook URL. Copy it.",
      "Add it as an endpoint below and tick the events you care about.",
      "Back in Zapier, add whatever action you want — 8,000+ apps are available.",
    ],
    suggestedEvents: ["contact.created", "booking.created"],
    docs: { label: "Zapier webhooks guide", href: "https://zapier.com/apps/webhook/integrations" },
  },
  make: {
    steps: [
      "In Make, add a “Webhooks → Custom webhook” module to a new scenario.",
      "Click “Add”, name it, and copy the URL Make generates.",
      "Add it as an endpoint below and tick the events you care about.",
      "Run the scenario once so Make learns the payload shape.",
    ],
    suggestedEvents: ["contact.created", "conversation.assigned"],
    docs: { label: "Make custom webhooks", href: "https://www.make.com/en/help/tools/webhooks" },
  },
  n8n: {
    steps: [
      "In n8n, add a “Webhook” node and set the method to POST.",
      "Copy the production URL from the node.",
      "Add it as an endpoint below and tick the events you care about.",
      "Activate the workflow so the production URL starts listening.",
    ],
    suggestedEvents: ["message.received", "booking.created"],
    docs: { label: "n8n webhook node", href: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/" },
  },
  slack: {
    steps: [
      "In Slack, open Apps → Incoming Webhooks and add it to the channel you want.",
      "Copy the webhook URL Slack gives you.",
      "Add it as an endpoint below and tick “Conversation assigned”.",
      "Your team now gets a Slack message whenever a customer needs a person.",
    ],
    suggestedEvents: ["conversation.assigned"],
    docs: { label: "Slack incoming webhooks", href: "https://api.slack.com/messaging/webhooks" },
  },
  "google-sheets": {
    steps: [
      "Create a Zap (or Make scenario) with a “Catch Hook” trigger.",
      "Copy the URL it gives you and add it as an endpoint below.",
      "Pick “Google Sheets → Create Spreadsheet Row” as the action.",
      "Map the fields you want and every new lead lands as a row.",
    ],
    suggestedEvents: ["contact.created"],
  },
  hubspot: {
    steps: [
      "Create a Zap with a “Catch Hook” trigger and copy its URL.",
      "Add that URL as an endpoint below, ticking “Contact created”.",
      "Choose “HubSpot → Create or Update Contact” as the Zap action.",
      "Map name, phone and the lead source, then turn the Zap on.",
    ],
    suggestedEvents: ["contact.created"],
  },
  pipedrive: {
    steps: [
      "Create a Zap with a “Catch Hook” trigger and copy its URL.",
      "Add that URL as an endpoint below, ticking “Contact created”.",
      "Choose “Pipedrive → Create Deal” as the Zap action.",
      "Map the person and deal title, then turn the Zap on.",
    ],
    suggestedEvents: ["contact.created"],
  },
};

export function recipeFor(appId: string): BridgeRecipe {
  return (
    BRIDGE_RECIPES[appId] ?? {
      steps: [
        "Create a webhook URL in the other tool.",
        "Add it as an endpoint below and tick the events you want.",
      ],
      suggestedEvents: [CATCH_HOOK],
    }
  );
}

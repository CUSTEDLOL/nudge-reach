/**
 * Demo restaurant seed (spec §3.4): a rich, realistic workspace for "The
 * Spice Garden" — contacts with stages/tags, a staffed inbox with real
 * dining threads, a template library, sent/scheduled/draft campaigns,
 * automations with run logs, teammate memberships and an API key — so every
 * module of the app demos instantly on first sign-in.
 *
 * Deterministic (no AI calls, no Math.random) and idempotent (upserts /
 * find-before-create) — safe to re-run any time. Consent-safe: re-running
 * never flips an opted-out contact back to opted-in.
 *
 * Entry points: the CLI wrapper (scripts/seed-demo.ts) and the in-app
 * "Reset demo data" action (simulation mode only) both call
 * `seedDemoWorkspace(prisma, orgId?)`.
 */
import { createHash } from "node:crypto";
import { buildTemplatePayload } from "../whatsapp/template";
import { installRevenueRecoveryPack } from "../followup/install";
import { questionKey } from "../knowledge/normalize";
import type { CampaignContent } from "../campaign/schema";
import type { LeadStage, MessageStatus, Prisma, PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Deterministic time helpers (relative to the moment the seed runs)
// ---------------------------------------------------------------------------

// Set at the top of seedDemoWorkspace so a long-lived server process seeds
// relative to "now", not to module-load time.
let NOW = new Date();

/** A date `days` ago at a fixed local time — keeps threads looking human. */
function daysAgo(days: number, hour = 12, minute = 0): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3_600_000);
}

function minutesAfter(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60_000);
}

// ---------------------------------------------------------------------------
// Fixed demo actors
// ---------------------------------------------------------------------------

const AGENT_1 = "demo-agent-1"; // Sarah Chen
const AGENT_2 = "demo-agent-2"; // David Tan

// ---------------------------------------------------------------------------
// Tags (6, with badge-tone colors)
// ---------------------------------------------------------------------------

const TAGS: Array<{ name: string; color: string }> = [
  { name: "VIP", color: "amber" },
  { name: "Regular diner", color: "emerald" },
  { name: "New guest", color: "sky" },
  { name: "Weekend bruncher", color: "rose" },
  { name: "Catering lead", color: "violet" },
  { name: "Vegetarian", color: "neutral" },
];

// ---------------------------------------------------------------------------
// Contacts (40 — mixed stages/tags/sources/emails, 4 opted out)
// ---------------------------------------------------------------------------

interface SeedContact {
  name: string;
  stage: LeadStage;
  source: string;
  /** null = no email on file */
  email: string | null;
  tags: string[];
  assigned: string | null; // Membership.userId
  optedOut?: boolean;
  lastContactedDaysAgo?: number;
}

function gmail(name: string): string {
  return `${name.toLowerCase().replace(/\s+/g, ".")}@gmail.com`;
}

// Phones are +919810000101 … +919810000140 (first five match the original
// Phase-5 seed so existing rows get enriched, not duplicated).
const CONTACTS: SeedContact[] = [
  { name: "Emily Tan", stage: "QUALIFIED", source: "in_store", email: gmail("Emily Tan"), tags: ["VIP", "Regular diner"], assigned: AGENT_1, lastContactedDaysAgo: 0 },
  { name: "James Carter", stage: "WON", source: "in_store", email: gmail("James Carter"), tags: ["Regular diner"], assigned: null, lastContactedDaysAgo: 2 },
  { name: "Sophie Muller", stage: "WON", source: "in_store", email: null, tags: ["VIP", "Regular diner"], assigned: AGENT_2, lastContactedDaysAgo: 9 },
  { name: "Daniel Ong", stage: "CONTACTED", source: "in_store", email: gmail("Daniel Ong"), tags: [], assigned: null, lastContactedDaysAgo: 1 },
  { name: "Rachel Wong", stage: "CONTACTED", source: "csv_import", email: gmail("Rachel Wong"), tags: ["Weekend bruncher"], assigned: AGENT_1, lastContactedDaysAgo: 5 },
  { name: "Jason Teo", stage: "CONTACTED", source: "website", email: null, tags: ["Vegetarian"], assigned: null, lastContactedDaysAgo: 1 },
  { name: "Chloe Ng", stage: "QUALIFIED", source: "whatsapp", email: gmail("Chloe Ng"), tags: ["Weekend bruncher"], assigned: AGENT_2, lastContactedDaysAgo: 2 },
  { name: "Ryan Koh", stage: "NEW", source: "csv_import", email: gmail("Ryan Koh"), tags: [], assigned: null },
  { name: "Amelia Foster", stage: "CONTACTED", source: "referral", email: null, tags: ["Weekend bruncher"], assigned: AGENT_1, lastContactedDaysAgo: 7 },
  { name: "Nathan Lee", stage: "QUALIFIED", source: "in_store", email: gmail("Nathan Lee"), tags: ["Regular diner"], assigned: null, lastContactedDaysAgo: 4 },
  { name: "Grace Liu", stage: "NEW", source: "website", email: gmail("Grace Liu"), tags: [], assigned: null },
  { name: "Kevin Goh", stage: "CONTACTED", source: "csv_import", email: null, tags: [], assigned: AGENT_2, lastContactedDaysAgo: 8 },
  { name: "Hannah Schmidt", stage: "LOST", source: "csv_import", email: gmail("Hannah Schmidt"), tags: [], assigned: null, optedOut: true, lastContactedDaysAgo: 6 },
  { name: "Lucas Chen", stage: "NEW", source: "website", email: gmail("Lucas Chen"), tags: [], assigned: null },
  { name: "Olivia Ho", stage: "WON", source: "in_store", email: null, tags: ["Regular diner"], assigned: AGENT_1, lastContactedDaysAgo: 12 },
  { name: "William Chua", stage: "QUALIFIED", source: "whatsapp", email: gmail("William Chua"), tags: ["Catering lead"], assigned: AGENT_1, lastContactedDaysAgo: 4 },
  { name: "Isabelle Loh", stage: "CONTACTED", source: "referral", email: gmail("Isabelle Loh"), tags: ["Weekend bruncher"], assigned: null, lastContactedDaysAgo: 10 },
  { name: "Ethan Yap", stage: "NEW", source: "csv_import", email: null, tags: [], assigned: null },
  { name: "Mia Fernandez", stage: "CONTACTED", source: "website", email: gmail("Mia Fernandez"), tags: ["Vegetarian"], assigned: null, lastContactedDaysAgo: 2 },
  { name: "Aaron Sim", stage: "NEW", source: "csv_import", email: gmail("Aaron Sim"), tags: [], assigned: null },
  { name: "Zoe Richards", stage: "CONTACTED", source: "in_store", email: null, tags: ["Regular diner"], assigned: AGENT_2, lastContactedDaysAgo: 6 },
  { name: "Brandon Yeo", stage: "NEW", source: "website", email: gmail("Brandon Yeo"), tags: [], assigned: null },
  { name: "Charlotte Toh", stage: "QUALIFIED", source: "referral", email: gmail("Charlotte Toh"), tags: ["Weekend bruncher"], assigned: AGENT_1, lastContactedDaysAgo: 3 },
  { name: "Felix Wagner", stage: "LOST", source: "csv_import", email: null, tags: [], assigned: null, optedOut: true, lastContactedDaysAgo: 13 },
  { name: "Nicole Pang", stage: "CONTACTED", source: "in_store", email: gmail("Nicole Pang"), tags: [], assigned: null, lastContactedDaysAgo: 11 },
  { name: "Gabriel Seah", stage: "WON", source: "in_store", email: gmail("Gabriel Seah"), tags: ["VIP"], assigned: AGENT_2, lastContactedDaysAgo: 5 },
  { name: "Lily Kwan", stage: "NEW", source: "website", email: null, tags: [], assigned: null },
  { name: "Adam Turner", stage: "CONTACTED", source: "csv_import", email: gmail("Adam Turner"), tags: ["Vegetarian"], assigned: null, lastContactedDaysAgo: 9 },
  { name: "Vanessa Chia", stage: "LOST", source: "website", email: null, tags: [], assigned: null, optedOut: true, lastContactedDaysAgo: 14 },
  { name: "Oscar Lam", stage: "NEW", source: "csv_import", email: gmail("Oscar Lam"), tags: [], assigned: null },
  { name: "Elena Petrova", stage: "QUALIFIED", source: "referral", email: gmail("Elena Petrova"), tags: ["Weekend bruncher"], assigned: AGENT_1, lastContactedDaysAgo: 3 },
  { name: "Tom Baker", stage: "CONTACTED", source: "whatsapp", email: null, tags: ["Catering lead"], assigned: null, lastContactedDaysAgo: 7 },
  { name: "Serena Quek", stage: "WON", source: "in_store", email: gmail("Serena Quek"), tags: ["VIP", "Regular diner"], assigned: AGENT_2, lastContactedDaysAgo: 8 },
  { name: "Jonathan Pereira", stage: "NEW", source: "csv_import", email: null, tags: [], assigned: null },
  { name: "Alicia Fong", stage: "CONTACTED", source: "website", email: gmail("Alicia Fong"), tags: ["New guest"], assigned: null, lastContactedDaysAgo: 1 },
  { name: "Diego Alvarez", stage: "LOST", source: "csv_import", email: null, tags: [], assigned: null, optedOut: true, lastContactedDaysAgo: 12 },
  { name: "Max Weber", stage: "NEW", source: "website", email: gmail("Max Weber"), tags: ["New guest"], assigned: null },
  { name: "Bella Chin", stage: "NEW", source: "in_store", email: null, tags: ["New guest"], assigned: null, lastContactedDaysAgo: 1 },
  { name: "Noah Fischer", stage: "NEW", source: "referral", email: gmail("Noah Fischer"), tags: ["New guest"], assigned: null },
  { name: "Wendy Soh", stage: "NEW", source: "website", email: gmail("Wendy Soh"), tags: ["New guest"], assigned: null, lastContactedDaysAgo: 0 },
];

function phoneFor(index: number): string {
  return `+919810000${101 + index}`;
}

// ---------------------------------------------------------------------------
// Conversations (10 — mixed status/assignment/unread, real dining threads)
// ---------------------------------------------------------------------------

interface SeedMessage {
  dir: "inbound" | "outbound";
  body: string;
  /** minutes after the conversation start */
  at: number;
}

interface SeedConversation {
  contactIndex: number;
  status: "open" | "pending" | "resolved" | "handoff";
  assigned: string | null;
  unread: number;
  start: Date;
  messages: SeedMessage[];
  notes?: Array<{ authorUserId: string; authorName: string; body: string }>;
}

const CONVERSATIONS: SeedConversation[] = [
  {
    contactIndex: 0, // Emily Tan
    status: "open",
    assigned: AGENT_1,
    unread: 2,
    start: hoursAgo(3),
    messages: [
      { dir: "inbound", body: "Hi! Do you have a table for 4 this Saturday around 7:30pm?", at: 0 },
      { dir: "outbound", body: "Hi Emily! 😊 Saturday 7:30pm for 4 — we have the garden terrace or the main dining room. Any preference?", at: 4 },
      { dir: "inbound", body: "Garden terrace please, it was lovely last time", at: 9 },
      { dir: "outbound", body: "Done! Terrace table for 4, Saturday 7:30pm. Should I also pre-order the slow-roasted lamb shank? It sells out most weekends.", at: 14 },
      { dir: "inbound", body: "Yes please, one lamb shank! Also — do you have a vegetarian tasting menu?", at: 150 },
      { dir: "inbound", body: "And is parking available nearby?", at: 156 },
    ],
    notes: [
      {
        authorUserId: AGENT_1,
        authorName: "Sarah Chen",
        body: "Regular guest — loves the garden terrace, usually orders the lamb shank. Celebrated her promotion here in June.",
      },
    ],
  },
  {
    contactIndex: 5, // Jason Teo
    status: "open",
    assigned: null,
    unread: 1,
    start: daysAgo(1, 11, 20),
    messages: [
      { dir: "inbound", body: "Hi, I booked a table for 2 tonight at 8pm but something came up. Can I move it to tomorrow same time?", at: 0 },
      { dir: "outbound", body: "No problem Jason! Moved your table for 2 to tomorrow 8pm. See you then 😊", at: 6 },
      { dir: "inbound", body: "Thanks! By the way, most of your mains have meat — do you have a proper vegetarian selection?", at: 12 },
      { dir: "inbound", body: "And how late is the kitchen open?", at: 15 },
      { dir: "outbound", body: "Hello! We're open Tue–Sun, 11:30am–10:30pm — the kitchen takes last orders at 10pm 😊", at: 16 },
    ],
  },
  {
    contactIndex: 6, // Chloe Ng
    status: "open",
    assigned: AGENT_2,
    unread: 3,
    start: daysAgo(2, 16, 0),
    messages: [
      { dir: "inbound", body: "Hello! I saw the chef's tasting menu on your Instagram — is it available this week?", at: 0 },
      { dir: "outbound", body: "Hi Chloe! Yes — 7 courses at ₹2,499 per person, available Thursday to Sunday evenings.", at: 10 },
      { dir: "inbound", body: "Perfect. Can you do it for 6 people this Friday 8pm?", at: 25 },
      { dir: "outbound", body: "Absolutely — for groups of 6+ we reserve the private dining room at no extra charge.", at: 30 },
      { dir: "outbound", body: "I can hold Friday 8pm for you right now if you'd like 😊", at: 32 },
      { dir: "inbound", body: "Sorry for the slow reply — yes please, hold it! It's my mum's 60th birthday", at: 2850 },
      { dir: "inbound", body: "One more thing — can you arrange a birthday cake?", at: 2852 },
      { dir: "inbound", body: "And is parking available at the restaurant?", at: 2854 },
    ],
  },
  {
    contactIndex: 1, // James Carter
    status: "open",
    assigned: "OWNER", // replaced with org.ownerUserId at runtime
    unread: 0,
    start: daysAgo(3, 12, 30),
    messages: [
      { dir: "inbound", body: "Hi, checking on my catering order for Friday — office lunch for 25, order #1024", at: 0 },
      { dir: "outbound", body: "Hi James! Your order is confirmed — 25 lunch boxes (12 butter chicken, 8 paneer tikka, 5 vegan curry) for Friday 12:30pm.", at: 8 },
      { dir: "inbound", body: "Great. Can delivery come to the 14th floor reception directly?", at: 12 },
      { dir: "outbound", body: "Noted — our driver will bring it up to level 14 reception and call you on arrival.", at: 20 },
      { dir: "outbound", body: "Update: your Friday order is packed and scheduled — driver leaves at 11:45am, arriving ~12:20pm 📦", at: 1440 },
    ],
  },
  {
    contactIndex: 15, // William Chua
    status: "pending",
    assigned: AGENT_1,
    unread: 0,
    start: daysAgo(5, 11, 0),
    messages: [
      { dir: "inbound", body: "Hi, I'm organising our company's annual dinner — do you do buffet catering for about 50 people?", at: 0 },
      { dir: "outbound", body: "Hi William! Yes we do — our banquet buffet starts at 20 pax. What date are you looking at?", at: 9 },
      { dir: "inbound", body: "Last Friday of next month, 50 people, mix of vegetarian and non-veg", at: 22 },
      { dir: "outbound", body: "For 50 pax our premium buffet is ₹680 per head with live counters, GST invoice included. Sending the menu now.", at: 30 },
      { dir: "inbound", body: "Budget is a bit tight — if you can do ₹650 per head I'll confirm today", at: 55 },
      { dir: "outbound", body: "Let me check with the owner and get back to you by tomorrow 👍", at: 60 },
    ],
    notes: [
      {
        authorUserId: AGENT_1,
        authorName: "Sarah Chen",
        body: "Corporate annual dinner — 50 pax premium buffet. Waiting on owner approval for ₹650/head.",
      },
    ],
  },
  {
    contactIndex: 18, // Mia Fernandez
    status: "pending",
    assigned: null,
    unread: 2,
    start: daysAgo(2, 13, 15),
    messages: [
      { dir: "inbound", body: "Hi, do you host birthday dinners? Planning something for my sister, about 12 people", at: 0 },
      { dir: "outbound", body: "Hi Mia! We'd love to — our private dining room seats up to 14, and decorations are on us for birthdays 🎉", at: 7 },
      { dir: "inbound", body: "Perfect. She's vegetarian — can the set menu be fully vegetarian?", at: 15 },
      { dir: "inbound", body: "Also what are your Sunday hours?", at: 17 },
    ],
  },
  {
    contactIndex: 2, // Sophie Muller
    status: "resolved",
    assigned: AGENT_2,
    unread: 0,
    start: daysAgo(10, 17, 0),
    messages: [
      { dir: "inbound", body: "Hi! Do you take reservations for anniversaries? Saw your terrace on the website", at: 0 },
      { dir: "outbound", body: "Hi Sophie! Yes — the garden terrace is perfect for anniversaries, and we can set up candles and flowers.", at: 5 },
      { dir: "inbound", body: "How much is the candlelight setup?", at: 12 },
      { dir: "outbound", body: "₹1,499 including a bouquet, candles and a complimentary dessert platter. Only 2 terrace slots left for Saturday!", at: 16 },
      { dir: "inbound", body: "Please reserve one for us, we'll come at 7", at: 24 },
      { dir: "outbound", body: "Done! Terrace table reserved for Saturday 7pm under your name 😊", at: 28 },
      { dir: "inbound", body: "Thank you!", at: 31 },
      { dir: "outbound", body: "Reminder: your candlelight anniversary table is reserved for tonight ✨", at: 1080 },
      { dir: "inbound", body: "We'll be there at 7!", at: 1105 },
      { dir: "outbound", body: "Perfect, see you soon!", at: 1108 },
      { dir: "inbound", body: "The evening was magical — thank you so much! ❤️", at: 1500 },
      { dir: "outbound", body: "Thank you Sophie! It was our pleasure. Do try the weekend brunch sometime 🥂", at: 1510 },
    ],
  },
  {
    contactIndex: 9, // Nathan Lee
    status: "resolved",
    assigned: "OWNER",
    unread: 0,
    start: daysAgo(4, 10, 45),
    messages: [
      { dir: "inbound", body: "What are your hours today?", at: 0 },
      { dir: "outbound", body: "Hello! We're open Tue–Sun, 11:30am–10:30pm — the kitchen takes last orders at 10pm 😊", at: 1 },
      { dir: "inbound", body: "Thanks. What's the price range for the set lunch?", at: 6 },
      { dir: "outbound", body: "Weekday set lunch is ₹499 for 3 courses; à la carte mains run ₹350–₹650.", at: 11 },
      { dir: "inbound", body: "Nice, I'll drop by this week. Thanks!", at: 15 },
    ],
  },
  {
    contactIndex: 12, // Hannah Schmidt (opted out)
    status: "resolved",
    assigned: null,
    unread: 0,
    start: daysAgo(6, 19, 0),
    messages: [
      { dir: "outbound", body: "Hi Hannah, our new weekend brunch menu is here! Bottomless masala chai and live dosa counter, this weekend only 🥞", at: 0 },
      { dir: "inbound", body: "STOP", at: 34 },
      { dir: "outbound", body: "You won't receive any more marketing messages from us. Thank you.", at: 35 },
      { dir: "inbound", body: "Ok", at: 40 },
    ],
  },
  {
    contactIndex: 3, // Daniel Ong
    status: "handoff",
    assigned: null,
    unread: 2,
    start: daysAgo(1, 18, 30),
    messages: [
      { dir: "inbound", body: "My delivery order arrived an hour late and completely cold. This is not what I expect from you", at: 0 },
      { dir: "outbound", body: "Daniel, we're really sorry about this. Could you share your order number so we can check what happened?", at: 5 },
      { dir: "inbound", body: "Order #2087. ₹1,850 for a family dinner and nobody could eat it warm", at: 18 },
      { dir: "outbound", body: "You're absolutely right to be upset. A senior team member will contact you shortly.", at: 22 },
      { dir: "inbound", body: "I want a refund or a fresh replacement, simple", at: 45 },
      { dir: "inbound", body: "If I don't hear back today I'm posting the photos on Google reviews", at: 47 },
      { dir: "outbound", body: "Daniel, the owner has been informed — you'll get a call before 7pm today 🙏", at: 52 },
    ],
    notes: [
      {
        authorUserId: "OWNER",
        authorName: "Owner",
        body: "Refund approved against order #2087. Handle personally — long-time guest, escalation risk.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Library templates (4 — approved / pending / draft / rejected)
// ---------------------------------------------------------------------------

interface SeedTemplate {
  name: string;
  status: "APPROVED" | "PENDING" | "DRAFT" | "REJECTED";
  rejectionReason?: string;
  content: CampaignContent;
}

const LIBRARY_TEMPLATES: SeedTemplate[] = [
  {
    name: "weekend_brunch_launch",
    status: "APPROVED",
    content: {
      productName: "Weekend Brunch",
      campaignAngle: "Launch-week excitement for the new weekend brunch menu.",
      header: "Weekend brunch has arrived 🥞",
      body: "Hi {{1}}, our new weekend brunch is here! Live dosa counter, bottomless masala chai and 20 new dishes — launch price ₹799 per person this weekend only. Tables go fast, book yours now!",
      footer: "Reply STOP to unsubscribe",
      buttons: [
        { type: "QUICK_REPLY", text: "See the menu" },
        { type: "QUICK_REPLY", text: "Book a table" },
      ],
      sampleName: "Emily",
      imageTreatment: "Overhead shot of the full brunch spread on a rustic wooden table, morning light.",
      notes: "Evergreen launch template — reuse for every menu drop.",
    },
  },
  {
    name: "new_menu_alert",
    status: "PENDING",
    content: {
      productName: "Seasonal Menu",
      campaignAngle: "First-look privilege for regulars when the seasonal menu changes.",
      header: "New seasonal menu, just for you",
      body: "Hi {{1}}, our chef's new seasonal menu is in — monsoon specials, slow-cooked curries and three new desserts. Our regulars get first pick, so we're telling you before anyone else 😊",
      footer: "Reply STOP to unsubscribe",
      buttons: [{ type: "QUICK_REPLY", text: "Show me" }],
      sampleName: "Emily",
      imageTreatment: "Close-up of the chef plating the new signature dish, kitchen bokeh behind.",
      notes: "Send within 48h of the menu change going live.",
    },
  },
  {
    name: "weekday_lunch_deal",
    status: "DRAFT",
    content: {
      productName: "Set Lunch",
      campaignAngle: "Short urgency window: weekday-only pricing on the 3-course set lunch.",
      header: "Weekday set lunch ⚡",
      body: "Hi {{1}}, this week only — our 3-course set lunch at ₹499! Perfect for office lunches, Tuesday to Friday, 11:30am–3pm. Reply to reserve your table.",
      footer: "Reply STOP to unsubscribe",
      buttons: [
        { type: "QUICK_REPLY", text: "Reserve a table" },
        { type: "QUICK_REPLY", text: "See the menu" },
      ],
      sampleName: "Emily",
      imageTreatment: "Three-course set neatly arranged on a tray with the lunch menu card.",
      notes: "Draft — finalize the price with the owner before submitting.",
    },
  },
  {
    name: "happy_hour_promo",
    status: "REJECTED",
    rejectionReason:
      'Rejected by Meta review (simulated): promotional claim "guaranteed cheapest drinks" violates advertising policy. Rephrase the claim and resubmit.',
    content: {
      productName: "Happy Hour",
      campaignAngle: "Evening urgency: happy-hour pricing on drinks and starters.",
      header: "Happy hour — guaranteed cheapest drinks",
      body: "Hi {{1}}, happy hour is back — guaranteed cheapest drinks in the neighbourhood! 1-for-1 mocktails and half-price starters, 5–7pm daily. See you this evening!",
      footer: "Reply STOP to unsubscribe",
      buttons: [{ type: "QUICK_REPLY", text: "See offers" }],
      sampleName: "Emily",
      imageTreatment: "Two frosted mocktails clinking on the terrace bar at golden hour.",
      notes: "Needs rewording — remove the price-guarantee claim.",
    },
  },
];

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

const DRAFT_CAMPAIGN_CONTENT: CampaignContent = {
  productName: "Chef's Tasting Menu",
  campaignAngle: "Exclusivity: a 7-course chef's tasting menu with limited seats.",
  header: "The chef's table is open ✨",
  body: "Hi {{1}}, our new 7-course chef's tasting menu is here — seasonal ingredients, wine pairings, and only 12 seats a night. Book this week and enjoy a complimentary dessert course on us!",
  footer: "Reply STOP to unsubscribe",
  buttons: [
    { type: "QUICK_REPLY", text: "See the courses" },
    { type: "QUICK_REPLY", text: "Book a seat" },
  ],
  sampleName: "Emily",
  imageTreatment: "The chef's counter at dusk, plates mid-service, warm tungsten light.",
  notes: "Fine-dining crowd converts best Thursday evening.",
};

const SENT_CAMPAIGN_CONTENT: CampaignContent = {
  productName: "Weekend Brunch",
  campaignAngle: "Launch urgency: new weekend brunch at a launch price for regulars.",
  header: "Weekend brunch is here 🥞",
  body: "Hi {{1}}, our brand-new weekend brunch has launched! Live dosa counter, bottomless masala chai and 20 new dishes — launch price ₹799 per person this weekend. Regulars get priority seating, book now!",
  footer: "Reply STOP to unsubscribe",
  buttons: [
    { type: "QUICK_REPLY", text: "See the menu" },
    { type: "QUICK_REPLY", text: "Book a table" },
  ],
  sampleName: "Emily",
  imageTreatment: "The full brunch spread from above, terrace sunlight, chai being poured.",
  notes: "Sent launch week — best performing campaign so far.",
};

const SCHEDULED_CAMPAIGN_CONTENT: CampaignContent = {
  productName: "Set Lunch",
  campaignAngle: "Weekday value: 3-course set lunch for the office crowd.",
  header: "Set lunch special ⚡",
  body: "Hi {{1}}, this week only — our 3-course weekday set lunch at ₹499! Starter, main and dessert, served in under 45 minutes. Tue–Fri, 11:30am–3pm. Reply to reserve your table 😊",
  footer: "Reply STOP to unsubscribe",
  buttons: [
    { type: "QUICK_REPLY", text: "See the menu" },
    { type: "QUICK_REPLY", text: "Reserve a table" },
  ],
  sampleName: "Emily",
  imageTreatment: "A crisp three-course tray on a marble table with the lunch card.",
  notes: "Scheduled for tomorrow morning — audience: weekend brunchers.",
};

// SENT campaign per-recipient statuses (25 rows: 9 READ, 6 DELIVERED,
// 3 CLICKED, 4 SENT, 3 FAILED) — written directly, not via the send queue.
const SENT_STATUSES: MessageStatus[] = [
  "READ", "DELIVERED", "READ", "SENT", "CLICKED",
  "READ", "DELIVERED", "FAILED", "READ", "DELIVERED",
  "CLICKED", "READ", "SENT", "DELIVERED", "READ",
  "FAILED", "READ", "DELIVERED", "CLICKED", "READ",
  "SENT", "DELIVERED", "READ", "SENT", "FAILED",
];

const MARKETING_COST_PAISE = 88; // ~₹0.88 per delivered marketing message

// ---------------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------------

async function seedMemberships(prisma: PrismaClient, orgId: string, ownerUserId: string) {
  const rows = [
    { userId: ownerUserId, email: "owner@nudge.local", displayName: "Owner", role: "OWNER" as const },
    { userId: AGENT_1, email: "sarah.chen@nudge.demo", displayName: "Sarah Chen", role: "AGENT" as const },
    { userId: AGENT_2, email: "david.tan@nudge.demo", displayName: "David Tan", role: "AGENT" as const },
  ];
  for (const row of rows) {
    await prisma.membership.upsert({
      where: { orgId_userId: { orgId, userId: row.userId } },
      create: { orgId, ...row },
      update: {}, // never overwrite a real membership (e.g. owner's real email)
    });
  }
}

async function seedTags(prisma: PrismaClient, orgId: string): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  for (const tag of TAGS) {
    const row = await prisma.tag.upsert({
      where: { orgId_name: { orgId, name: tag.name } },
      create: { orgId, ...tag },
      update: { color: tag.color },
    });
    byName.set(row.name, row.id);
  }
  return byName;
}

async function seedContacts(
  prisma: PrismaClient,
  orgId: string,
  tagIds: Map<string, string>
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < CONTACTS.length; i++) {
    const c = CONTACTS[i];
    const shared = {
      name: c.name,
      email: c.email,
      optInSource: c.source,
      leadStage: c.stage,
      assignedToUserId: c.assigned,
      lastContactedAt:
        c.lastContactedDaysAgo === undefined ? null : daysAgo(c.lastContactedDaysAgo, 18, 0),
    };
    // Consent-safe updates: never re-opt-in an existing contact on re-run.
    const consentCreate = c.optedOut
      ? { optedIn: false, optedOutAt: daysAgo(6, 19, 35) }
      : { optedIn: true };
    const consentUpdate = c.optedOut
      ? { optedIn: false, optedOutAt: daysAgo(6, 19, 35) }
      : {};
    const row = await prisma.contact.upsert({
      where: { orgId_phoneE164: { orgId, phoneE164: phoneFor(i) } },
      create: { orgId, phoneE164: phoneFor(i), ...shared, ...consentCreate },
      update: { ...shared, ...consentUpdate },
    });
    ids.push(row.id);

    for (const tagName of c.tags) {
      const tagId = tagIds.get(tagName);
      if (!tagId) continue;
      await prisma.contactTag.upsert({
        where: { contactId_tagId: { contactId: row.id, tagId } },
        create: { contactId: row.id, tagId },
        update: {},
      });
    }
  }
  return ids;
}

async function seedAudiences(
  prisma: PrismaClient,
  orgId: string,
  contactIds: string[]
): Promise<Map<string, string>> {
  // Membership rules are derived deterministically from the contact list.
  const optedIn = (i: number) => !CONTACTS[i].optedOut;
  const defs: Array<{ name: string; memberIndexes: number[] }> = [
    {
      name: "Regular diners (demo)",
      memberIndexes: CONTACTS.map((_, i) => i).filter(
        (i) => optedIn(i) && (CONTACTS[i].tags.includes("Regular diner") || CONTACTS[i].stage === "WON" || i < 12)
      ),
    },
    {
      name: "Weekend brunchers",
      memberIndexes: CONTACTS.map((_, i) => i).filter(
        (i) => optedIn(i) && CONTACTS[i].tags.includes("Weekend bruncher")
      ),
    },
    {
      name: "VIP guests",
      memberIndexes: CONTACTS.map((_, i) => i).filter(
        (i) => optedIn(i) && CONTACTS[i].tags.includes("VIP")
      ),
    },
  ];

  const byName = new Map<string, string>();
  for (const def of defs) {
    let audience = await prisma.audience.findFirst({ where: { orgId, name: def.name } });
    if (!audience) {
      audience = await prisma.audience.create({ data: { orgId, name: def.name } });
    }
    byName.set(def.name, audience.id);
    for (const i of def.memberIndexes) {
      await prisma.audienceContact.upsert({
        where: { audienceId_contactId: { audienceId: audience.id, contactId: contactIds[i] } },
        create: { audienceId: audience.id, contactId: contactIds[i] },
        update: {},
      });
    }
  }
  return byName;
}

async function seedConversations(
  prisma: PrismaClient,
  orgId: string,
  ownerUserId: string,
  contactIds: string[]
): Promise<Map<number, string>> {
  const byContactIndex = new Map<number, string>();
  for (const conv of CONVERSATIONS) {
    const contactId = contactIds[conv.contactIndex];
    const assigned = conv.assigned === "OWNER" ? ownerUserId : conv.assigned;
    const last = conv.messages[conv.messages.length - 1];
    const preview = last.body.length > 80 ? `${last.body.slice(0, 77)}…` : last.body;

    const row = await prisma.conversation.upsert({
      where: { orgId_contactId: { orgId, contactId } },
      create: {
        orgId,
        contactId,
        status: conv.status,
        assignedToUserId: assigned,
        unreadCount: conv.unread,
        lastMessagePreview: preview,
        createdAt: conv.start,
      },
      update: {
        status: conv.status,
        assignedToUserId: assigned,
        unreadCount: conv.unread,
        lastMessagePreview: preview,
      },
    });
    byContactIndex.set(conv.contactIndex, row.id);

    // Messages only on first run — timestamps must stay coherent on re-runs.
    const existing = await prisma.conversationMessage.count({
      where: { conversationId: row.id },
    });
    if (existing === 0) {
      let lastInboundAt: Date | null = null;
      let lastMessageAt: Date | null = null;
      for (const msg of conv.messages) {
        const createdAt = minutesAfter(conv.start, msg.at);
        await prisma.conversationMessage.create({
          data: {
            conversationId: row.id,
            direction: msg.dir,
            body: msg.body,
            metaMessageId: null,
            createdAt,
          },
        });
        lastMessageAt = createdAt;
        if (msg.dir === "inbound") lastInboundAt = createdAt;
      }
      await prisma.conversation.update({
        where: { id: row.id },
        data: { lastInboundAt, lastMessageAt },
      });
    }

    for (const note of conv.notes ?? []) {
      const authorUserId = note.authorUserId === "OWNER" ? ownerUserId : note.authorUserId;
      const found = await prisma.note.findFirst({
        where: { orgId, conversationId: row.id, body: note.body },
      });
      if (!found) {
        await prisma.note.create({
          data: {
            orgId,
            conversationId: row.id,
            contactId,
            authorUserId,
            authorName: note.authorName,
            body: note.body,
          },
        });
      }
    }
  }
  return byContactIndex;
}

async function seedContactNotes(prisma: PrismaClient, orgId: string, contactIds: string[]) {
  // One standalone contact note (Gabriel Seah, VIP) from David.
  const body =
    "Prefers WhatsApp updates over calls. Wedding anniversary in November — offer the terrace early.";
  const contactId = contactIds[25];
  const found = await prisma.note.findFirst({
    where: { orgId, contactId, conversationId: null, body },
  });
  if (!found) {
    await prisma.note.create({
      data: { orgId, contactId, authorUserId: AGENT_2, authorName: "David Tan", body },
    });
  }
}

async function seedLibraryTemplates(
  prisma: PrismaClient,
  orgId: string
): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  for (const tpl of LIBRARY_TEMPLATES) {
    const componentsJson = buildTemplatePayload(tpl.content, {
      name: tpl.name,
    }) as Prisma.InputJsonValue;
    const data = {
      language: "en",
      category: "MARKETING",
      content: tpl.content,
      componentsJson,
      metaStatus: tpl.status,
      metaTemplateId: tpl.status === "APPROVED" ? `sim-tpl-${tpl.name}` : null,
      rejectionReason: tpl.rejectionReason ?? null,
    };
    const existing = await prisma.template.findFirst({
      where: { orgId, name: tpl.name, campaignId: null },
    });
    const row = existing
      ? await prisma.template.update({ where: { id: existing.id }, data })
      : await prisma.template.create({ data: { orgId, campaignId: null, name: tpl.name, ...data } });
    byName.set(tpl.name, row.id);
  }
  return byName;
}

async function ensureProduct(
  prisma: PrismaClient,
  orgId: string,
  name: string,
  description: string
): Promise<string> {
  const existing = await prisma.product.findFirst({ where: { orgId, name } });
  if (existing) return existing.id;
  const row = await prisma.product.create({
    data: { orgId, name, photoUrl: null, attributes: { description } },
  });
  return row.id;
}

async function seedCampaigns(
  prisma: PrismaClient,
  orgId: string,
  contactIds: string[],
  audienceIds: Map<string, string>
) {
  // 1) DRAFT — the chef's tasting menu campaign, kept and refreshed.
  const draftProductId = await ensureProduct(
    prisma, orgId,
    "Chef's Tasting Menu",
    "7-course seasonal tasting menu, 12 seats a night"
  );
  const draft = await prisma.campaign.findFirst({
    where: { orgId, name: "Chef's Tasting Menu" },
  });
  if (!draft) {
    await prisma.campaign.create({
      data: {
        orgId,
        productId: draftProductId,
        name: "Chef's Tasting Menu",
        status: "DRAFT",
        content: DRAFT_CAMPAIGN_CONTENT,
      },
    });
  } else if (draft.status === "DRAFT") {
    await prisma.campaign.update({
      where: { id: draft.id },
      data: { content: DRAFT_CAMPAIGN_CONTENT },
    });
  }

  // 2) SENT — brunch launch with ~25 realistic per-recipient Message rows.
  const sentProductId = await ensureProduct(
    prisma, orgId,
    "Weekend Brunch",
    "New weekend brunch — live dosa counter, 20 new dishes"
  );
  let sent = await prisma.campaign.findFirst({
    where: { orgId, name: "Weekend Brunch Launch" },
  });
  if (!sent) {
    sent = await prisma.campaign.create({
      data: {
        orgId,
        productId: sentProductId,
        name: "Weekend Brunch Launch",
        status: "SENT",
        content: SENT_CAMPAIGN_CONTENT,
        audienceId: audienceIds.get("Regular diners (demo)") ?? null,
        createdAt: daysAgo(6, 15, 0),
      },
    });
  }

  // Campaign-scoped template row (the real flow approves one before sending).
  const sentTplName = "weekend_brunch_launch_send";
  const sentTpl = await prisma.template.findFirst({
    where: { campaignId: sent.id, name: sentTplName },
  });
  if (!sentTpl) {
    await prisma.template.create({
      data: {
        campaignId: sent.id,
        name: sentTplName,
        language: "en",
        category: "MARKETING",
        componentsJson: buildTemplatePayload(SENT_CAMPAIGN_CONTENT, {
          name: sentTplName,
        }) as Prisma.InputJsonValue,
        metaStatus: "APPROVED",
        metaTemplateId: `sim-tpl-${sentTplName}`,
        submittedAt: daysAgo(6, 15, 30),
      },
    });
  }

  // Recipients: the first 25 opted-in contacts. Statuses written directly
  // (spec §3.4) — mixed READ/DELIVERED/CLICKED/SENT/FAILED with costs.
  const recipients = CONTACTS.map((_, i) => i)
    .filter((i) => !CONTACTS[i].optedOut)
    .slice(0, SENT_STATUSES.length);
  const sendBase = daysAgo(5, 18, 0);
  for (let k = 0; k < recipients.length; k++) {
    const status = SENT_STATUSES[k];
    const failed = status === "FAILED";
    const sentAt = minutesAfter(sendBase, k);
    await prisma.message.upsert({
      where: {
        campaignId_contactId: { campaignId: sent.id, contactId: contactIds[recipients[k]] },
      },
      create: {
        campaignId: sent.id,
        contactId: contactIds[recipients[k]],
        status,
        metaMessageId: failed ? null : `sim-wamid-brunch-${k + 1}`,
        errorCode: failed ? "131026" : null,
        costMinorUnits: failed ? null : MARKETING_COST_PAISE,
        sentAt: failed ? null : sentAt,
        createdAt: sentAt,
      },
      update: {},
    });
  }

  // 3) SCHEDULED — weekday set-lunch push going out tomorrow morning.
  const scheduledProductId = await ensureProduct(
    prisma, orgId,
    "Set Lunch",
    "3-course weekday set lunch, served in under 45 minutes"
  );
  const tomorrow = new Date(NOW);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 30, 0, 0);
  const scheduled = await prisma.campaign.findFirst({
    where: { orgId, name: "Set Lunch Special" },
  });
  if (!scheduled) {
    await prisma.campaign.create({
      data: {
        orgId,
        productId: scheduledProductId,
        name: "Set Lunch Special",
        status: "SCHEDULED",
        content: SCHEDULED_CAMPAIGN_CONTENT,
        audienceId: audienceIds.get("Weekend brunchers") ?? null,
        scheduledAt: tomorrow,
      },
    });
  } else if (scheduled.status === "SCHEDULED") {
    await prisma.campaign.update({
      where: { id: scheduled.id },
      data: { scheduledAt: tomorrow },
    });
  }
}

async function seedAutomations(
  prisma: PrismaClient,
  orgId: string,
  contactIds: string[],
  conversationIds: Map<number, string>,
  tagIds: Map<string, string>,
  templateIds: Map<string, string>
) {
  interface SeedAutomation {
    name: string;
    description: string;
    enabled: boolean;
    trigger: string;
    triggerConfig: Prisma.InputJsonObject;
    steps: Array<{ order: number; kind: string; config: Prisma.InputJsonObject }>;
  }

  const defs: SeedAutomation[] = [
    {
      name: "Opening hours FAQ",
      description: "Replies instantly when a guest asks about opening hours or timings.",
      enabled: true,
      trigger: "keyword",
      triggerConfig: {
        keywords: ["hours", "timing", "open", "close", "closing"],
        match: "contains",
      },
      steps: [
        {
          order: 1,
          kind: "send_message",
          config: {
            body: "Hello! We're open Tue–Sun, 11:30am–10:30pm — the kitchen takes last orders at 10pm 😊",
          },
        },
      ],
    },
    {
      name: "Welcome new guests",
      description: "Greets every new contact with the brunch launch template and tags them.",
      enabled: true,
      trigger: "contact_created",
      triggerConfig: {},
      steps: [
        {
          order: 1,
          kind: "send_template",
          config: {
            templateId: templateIds.get("weekend_brunch_launch") ?? null,
            templateName: "weekend_brunch_launch",
          },
        },
        {
          order: 2,
          kind: "add_tag",
          config: {
            tagId: tagIds.get("New guest") ?? null,
            tagName: "New guest",
          },
        },
      ],
    },
    {
      name: "Route VIPs to Sarah",
      description: "When the VIP tag is added, assigns the guest to Sarah and bumps the stage.",
      enabled: false,
      trigger: "tag_added",
      triggerConfig: { tagId: tagIds.get("VIP") ?? null, tagName: "VIP" },
      steps: [
        {
          order: 1,
          kind: "assign_agent",
          config: { userId: AGENT_1, displayName: "Sarah Chen" },
        },
        { order: 2, kind: "update_lead_stage", config: { stage: "QUALIFIED" } },
      ],
    },
  ];

  const idByName = new Map<string, string>();
  for (const def of defs) {
    let automation = await prisma.automation.findFirst({
      where: { orgId, name: def.name },
    });
    if (!automation) {
      automation = await prisma.automation.create({
        data: {
          orgId,
          name: def.name,
          description: def.description,
          enabled: def.enabled,
          trigger: def.trigger,
          triggerConfig: def.triggerConfig,
        },
      });
    } else {
      automation = await prisma.automation.update({
        where: { id: automation.id },
        data: {
          description: def.description,
          trigger: def.trigger,
          triggerConfig: def.triggerConfig,
        },
      });
    }
    idByName.set(def.name, automation.id);
    for (const step of def.steps) {
      await prisma.automationStep.upsert({
        where: { automationId_order: { automationId: automation.id, order: step.order } },
        create: { automationId: automation.id, ...step },
        update: { kind: step.kind, config: step.config },
      });
    }
  }

  // Run history on "Opening hours FAQ" (2 completed + 1 failed, with step logs).
  const faqId = idByName.get("Opening hours FAQ");
  if (faqId) {
    const existingRuns = await prisma.automationRun.count({
      where: { automationId: faqId },
    });
    if (existingRuns === 0) {
      const runs = [
        {
          contactIndex: 9, // Nathan Lee — resolved thread with the auto-reply
          status: "COMPLETED" as const,
          currentStep: 1,
          at: daysAgo(4, 10, 46),
          log: [
            {
              step: 1,
              kind: "send_message",
              status: "ok",
              detail: "Sent opening-hours reply within the 24h service window",
              at: daysAgo(4, 10, 46).toISOString(),
            },
          ],
        },
        {
          contactIndex: 5, // Jason Teo — open thread, hours question answered
          status: "COMPLETED" as const,
          currentStep: 1,
          at: daysAgo(1, 11, 36),
          log: [
            {
              step: 1,
              kind: "send_message",
              status: "ok",
              detail: "Sent opening-hours reply within the 24h service window",
              at: daysAgo(1, 11, 36).toISOString(),
            },
          ],
        },
        {
          contactIndex: 18, // Mia Fernandez — window had closed, send failed
          status: "FAILED" as const,
          currentStep: 1,
          at: daysAgo(1, 9, 5),
          log: [
            {
              step: 1,
              kind: "send_message",
              status: "error",
              detail: "24h service window closed — free-form send rejected (template required)",
              at: daysAgo(1, 9, 5).toISOString(),
            },
          ],
        },
      ];
      for (const run of runs) {
        await prisma.automationRun.create({
          data: {
            automationId: faqId,
            orgId,
            contactId: contactIds[run.contactIndex],
            conversationId: conversationIds.get(run.contactIndex) ?? null,
            status: run.status,
            currentStep: run.currentStep,
            log: run.log,
            createdAt: run.at,
          },
        });
      }
    }
  }
}

async function seedApiKey(prisma: PrismaClient, orgId: string) {
  // sha256 of a fixed throwaway string — the plaintext key is NOT usable
  // anywhere; this row only exercises the Integrations UI.
  const keyHash = createHash("sha256")
    .update("nk_demo_2f8c1a7b9d4e6f0a3b5c7d9e1f2a4b6c")
    .digest("hex");
  await prisma.apiKey.upsert({
    where: { keyHash },
    create: { orgId, name: "Demo integration key", prefix: "nk_demo", keyHash },
    update: {},
  });
}

/**
 * AI Front Desk demo state (the flagship moat): a trained + enabled agent, a
 * simulated calendar connection, the Revenue-Recovery pack, and a few confirmed
 * bookings — so calendar booking + follow-ups + the dashboard card demo out of
 * the box in keyless simulation. Idempotent.
 */
async function seedFrontDesk(
  prisma: PrismaClient,
  orgId: string,
  contactIds: string[]
) {
  await prisma.agentProfile.upsert({
    where: { orgId },
    create: {
      orgId,
      enabled: true,
      vertical: "restaurant",
      businessName: "The Spice Garden",
      businessInfo:
        "HOURS:\nTue–Sun 11:30am–10:30pm (kitchen last orders 10pm), closed Mondays\n\nSERVICES:\nDine-in, garden terrace, private dining room (up to 14), weekend brunch, corporate catering, birthday & anniversary setups\n\nPRICES:\nMains ₹350–₹650; weekday 3-course set lunch ₹499; chef's 7-course tasting menu ₹2,499 per person; weekend brunch ₹799 per person\n\nBOOKING & POLICIES:\nReservations recommended on weekends. Groups of 6+ and private dining require a ₹2,000 booking deposit (adjusted against the bill). Free cancellation up to 24h before.",
      tone: "Warm, welcoming, and concise",
      doNots: "Never confirm a table without checking availability. Never promise off-menu dishes.",
    },
    update: { enabled: true },
  });

  // Simulated calendar — the "sim" sentinel token never touches encryptSecret,
  // so this works with zero Google setup.
  await prisma.calendarAccount.upsert({
    where: { orgId },
    create: {
      orgId,
      provider: "google",
      accountEmail: "demo-calendar@nudge.local",
      calendarId: "primary",
      refreshTokenEncrypted: "sim",
      simulated: true,
    },
    update: { simulated: true, status: "connected" },
  });

  // Approved templates + composed automation + enabled FollowUpConfig.
  await installRevenueRecoveryPack(orgId);

  // Confirmed bookings so the "bookings this month" card + reminder tick have data.
  const bookings = [
    { name: "Emily Tan", contactId: contactIds[0], requestedFor: "Saturday 7:30pm", status: "confirmed", offsetHours: 20, event: "sim-cal-demo1" },
    { name: "James Carter", contactId: contactIds[1], requestedFor: "yesterday 8pm", status: "confirmed", offsetHours: -3, event: "sim-cal-demo2" },
    { name: "Sophie Muller", contactId: contactIds[2], requestedFor: "Monday 12:30pm", status: "no_show", offsetHours: -26, event: null as string | null },
  ];
  for (const b of bookings) {
    if (!b.contactId) continue;
    const exists = await prisma.bookingRequest.findFirst({
      where: { orgId, name: b.name },
    });
    if (exists) continue;
    await prisma.bookingRequest.create({
      data: {
        orgId,
        contactId: b.contactId,
        name: b.name,
        requestedFor: b.requestedFor,
        status: b.status,
        scheduledFor: new Date(NOW.getTime() + b.offsetHours * 3_600_000),
        calendarEventId: b.event,
      },
    });
  }

  // Structured knowledge (spec 2026-07-10) — includes conditional facts so the
  // "weekends only" demo answers correctly against TODAY.
  const knowledgeFacts: {
    category: string;
    fact: string;
    condition?: string;
  }[] = [
    { category: "menu_services", fact: "Modern Indian and pan-Asian menu — signatures: slow-roasted lamb shank, butter chicken, laksa, paneer tikka, vegan jackfruit curry" },
    { category: "menu_services", fact: "3-course set lunch served 11:30am–3pm", condition: "weekdays only" },
    { category: "menu_services", fact: "Brunch buffet with live dosa counter, 11am–3pm", condition: "weekends only" },
    { category: "pricing", fact: "Mains ₹350–₹650; weekday set lunch ₹499; chef's tasting menu ₹2,499 per person; weekend brunch ₹799 per person" },
    { category: "pricing", fact: "10% off the bill for groups of 10 or more", condition: "weekdays only" },
    { category: "hours", fact: "Open Tuesday to Sunday, 11:30am to 10:30pm; kitchen takes last orders at 10pm" },
    { category: "hours", fact: "Closed on Mondays" },
    { category: "location", fact: "12 Garden Lane, off MG Road — two minutes from the metro exit; free parking in the rear courtyard" },
    { category: "policies", fact: "Groups of 6+ and the private dining room require a ₹2,000 booking deposit, adjusted against the final bill; free cancellation up to 24 hours before" },
    { category: "payments", fact: "UPI, all major cards and cash accepted; international guests can pay booking deposits in USDC via a secure payment link" },
  ];
  if ((await prisma.knowledgeEntry.count({ where: { orgId } })) === 0) {
    await prisma.knowledgeEntry.createMany({
      data: knowledgeFacts.map((f) => ({
        orgId,
        category: f.category,
        fact: f.fact,
        condition: f.condition ?? null,
        source: "import",
      })),
    });
  }

  // One pending owner question so the /knowledge queue + dashboard nudge demo.
  const demoQuestion = "Do you have a kids' menu or high chairs?";
  const demoKey = questionKey(demoQuestion);
  const pendingExists = await prisma.ownerQuestion.findFirst({
    where: { orgId, questionKey: demoKey },
  });
  if (!pendingExists) {
    const convo = await prisma.conversation.findFirst({
      where: { orgId },
      select: { id: true, contactId: true },
    });
    await prisma.ownerQuestion.create({
      data: {
        orgId,
        question: demoQuestion,
        questionKey: demoKey,
        askCount: 2,
        waiting: convo
          ? [
              {
                conversationId: convo.id,
                contactId: convo.contactId,
                askedAt: NOW.toISOString(),
              },
            ]
          : [],
      },
    });
  }
}

// ---------------------------------------------------------------------------

export interface SeedCounts {
  memberships: number;
  tags: number;
  contacts: number;
  contactTags: number;
  audiences: number;
  conversations: number;
  conversationMessages: number;
  notes: number;
  libraryTemplates: number;
  campaigns: number;
  messages: number;
  automations: number;
  automationSteps: number;
  automationRuns: number;
  apiKeys: number;
}

/**
 * Seed (or re-seed — idempotent) the demo workspace. With no orgId, seeds the
 * first org found (the CLI case). Returns row counts for verification.
 */
export async function seedDemoWorkspace(
  prisma: PrismaClient,
  orgId?: string
): Promise<SeedCounts> {
  NOW = new Date();

  const org = orgId
    ? await prisma.org.findUniqueOrThrow({ where: { id: orgId } })
    : await prisma.org.findFirstOrThrow();

  // Mark the demo org onboarded (only fills blanks; never overwrites), and put
  // it on the AI Front Desk flagship so the whole moat (calendar, follow-ups,
  // concierge) is demoable in keyless simulation — the gate is checkAiFrontDesk,
  // and nothing else grants front_desk without a real payment.
  const periodEnd = new Date(NOW);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await prisma.org.update({
    where: { id: org.id },
    data: {
      vertical: org.vertical ?? "restaurant",
      onboardedAt: org.onboardedAt ?? NOW,
      plan: "front_desk",
      subscriptionStatus: "active",
      currentPeriodEnd: periodEnd,
      settings: {
        avgOrderValueInr: 1499,
        ...(typeof org.settings === "object" && org.settings !== null && !Array.isArray(org.settings)
          ? org.settings
          : {}),
      },
    },
  });

  await seedMemberships(prisma, org.id, org.ownerUserId);
  const tagIds = await seedTags(prisma, org.id);
  const contactIds = await seedContacts(prisma, org.id, tagIds);
  const audienceIds = await seedAudiences(prisma, org.id, contactIds);
  const conversationIds = await seedConversations(prisma, org.id, org.ownerUserId, contactIds);
  await seedContactNotes(prisma, org.id, contactIds);
  const templateIds = await seedLibraryTemplates(prisma, org.id);
  await seedCampaigns(prisma, org.id, contactIds, audienceIds);
  await seedAutomations(prisma, org.id, contactIds, conversationIds, tagIds, templateIds);
  await seedApiKey(prisma, org.id);
  await seedFrontDesk(prisma, org.id, contactIds);

  // Row counts (org-scoped where possible) so re-runs are easy to verify.
  const orgWhere = { orgId: org.id };
  const [
    memberships, tags, contacts, contactTags, audiences, conversations,
    conversationMessages, notes, libraryTemplates, campaigns, messages,
    automations, automationSteps, automationRuns, apiKeys,
  ] = await Promise.all([
    prisma.membership.count({ where: orgWhere }),
    prisma.tag.count({ where: orgWhere }),
    prisma.contact.count({ where: orgWhere }),
    prisma.contactTag.count({ where: { contact: orgWhere } }),
    prisma.audience.count({ where: orgWhere }),
    prisma.conversation.count({ where: orgWhere }),
    prisma.conversationMessage.count({ where: { conversation: orgWhere } }),
    prisma.note.count({ where: orgWhere }),
    prisma.template.count({ where: { orgId: org.id, campaignId: null } }),
    prisma.campaign.count({ where: orgWhere }),
    prisma.message.count({ where: { campaign: orgWhere } }),
    prisma.automation.count({ where: orgWhere }),
    prisma.automationStep.count({ where: { automation: orgWhere } }),
    prisma.automationRun.count({ where: orgWhere }),
    prisma.apiKey.count({ where: orgWhere }),
  ]);

  return {
    memberships, tags, contacts, contactTags, audiences, conversations,
    conversationMessages, notes, libraryTemplates, campaigns, messages,
    automations, automationSteps, automationRuns, apiKeys,
  };
}

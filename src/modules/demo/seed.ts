/**
 * Demo retailer seed (spec §3.4): a rich, realistic boutique workspace —
 * contacts with stages/tags, a staffed inbox with Hinglish threads, a
 * template library, sent/scheduled/draft campaigns, automations with run
 * logs, teammate memberships and an API key — so every module of the app
 * demos instantly on first sign-in.
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

const AGENT_1 = "demo-agent-1"; // Priya Sharma
const AGENT_2 = "demo-agent-2"; // Arjun Mehta

// ---------------------------------------------------------------------------
// Tags (6, with badge-tone colors)
// ---------------------------------------------------------------------------

const TAGS: Array<{ name: string; color: string }> = [
  { name: "VIP", color: "amber" },
  { name: "Repeat buyer", color: "emerald" },
  { name: "New customer", color: "sky" },
  { name: "Festive shopper", color: "rose" },
  { name: "Wholesale", color: "violet" },
  { name: "Window shopper", color: "neutral" },
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
  { name: "Ananya Gupta", stage: "QUALIFIED", source: "in_store", email: gmail("Ananya Gupta"), tags: ["VIP", "Repeat buyer"], assigned: AGENT_1, lastContactedDaysAgo: 0 },
  { name: "Rahul Verma", stage: "WON", source: "in_store", email: gmail("Rahul Verma"), tags: ["Repeat buyer"], assigned: null, lastContactedDaysAgo: 2 },
  { name: "Meera Iyer", stage: "WON", source: "in_store", email: null, tags: ["VIP", "Repeat buyer"], assigned: AGENT_2, lastContactedDaysAgo: 9 },
  { name: "Vikram Singh", stage: "CONTACTED", source: "in_store", email: gmail("Vikram Singh"), tags: [], assigned: null, lastContactedDaysAgo: 1 },
  { name: "Sneha Patel", stage: "CONTACTED", source: "csv_import", email: gmail("Sneha Patel"), tags: ["Festive shopper"], assigned: AGENT_1, lastContactedDaysAgo: 5 },
  { name: "Aarav Shah", stage: "CONTACTED", source: "website", email: null, tags: ["Window shopper"], assigned: null, lastContactedDaysAgo: 1 },
  { name: "Ishita Banerjee", stage: "QUALIFIED", source: "whatsapp", email: gmail("Ishita Banerjee"), tags: ["Festive shopper"], assigned: AGENT_2, lastContactedDaysAgo: 2 },
  { name: "Rohan Malhotra", stage: "NEW", source: "csv_import", email: gmail("Rohan Malhotra"), tags: [], assigned: null },
  { name: "Kavya Reddy", stage: "CONTACTED", source: "referral", email: null, tags: ["Festive shopper"], assigned: AGENT_1, lastContactedDaysAgo: 7 },
  { name: "Aditya Joshi", stage: "QUALIFIED", source: "in_store", email: gmail("Aditya Joshi"), tags: ["Repeat buyer"], assigned: null, lastContactedDaysAgo: 4 },
  { name: "Divya Nair", stage: "NEW", source: "website", email: gmail("Divya Nair"), tags: [], assigned: null },
  { name: "Karan Kapoor", stage: "CONTACTED", source: "csv_import", email: null, tags: [], assigned: AGENT_2, lastContactedDaysAgo: 8 },
  { name: "Pooja Agarwal", stage: "LOST", source: "csv_import", email: gmail("Pooja Agarwal"), tags: [], assigned: null, optedOut: true, lastContactedDaysAgo: 6 },
  { name: "Siddharth Rao", stage: "NEW", source: "website", email: gmail("Siddharth Rao"), tags: [], assigned: null },
  { name: "Neha Chopra", stage: "WON", source: "in_store", email: null, tags: ["Repeat buyer"], assigned: AGENT_1, lastContactedDaysAgo: 12 },
  { name: "Manish Tiwari", stage: "QUALIFIED", source: "whatsapp", email: gmail("Manish Tiwari"), tags: ["Wholesale"], assigned: AGENT_1, lastContactedDaysAgo: 4 },
  { name: "Ritika Sethi", stage: "CONTACTED", source: "referral", email: gmail("Ritika Sethi"), tags: ["Festive shopper"], assigned: null, lastContactedDaysAgo: 10 },
  { name: "Deepak Kumar", stage: "NEW", source: "csv_import", email: null, tags: [], assigned: null },
  { name: "Anjali Menon", stage: "CONTACTED", source: "website", email: gmail("Anjali Menon"), tags: ["Window shopper"], assigned: null, lastContactedDaysAgo: 2 },
  { name: "Harsh Vardhan", stage: "NEW", source: "csv_import", email: gmail("Harsh Vardhan"), tags: [], assigned: null },
  { name: "Shreya Ghosh", stage: "CONTACTED", source: "in_store", email: null, tags: ["Repeat buyer"], assigned: AGENT_2, lastContactedDaysAgo: 6 },
  { name: "Nikhil Bansal", stage: "NEW", source: "website", email: gmail("Nikhil Bansal"), tags: [], assigned: null },
  { name: "Tanvi Desai", stage: "QUALIFIED", source: "referral", email: gmail("Tanvi Desai"), tags: ["Festive shopper"], assigned: AGENT_1, lastContactedDaysAgo: 3 },
  { name: "Amit Saxena", stage: "LOST", source: "csv_import", email: null, tags: [], assigned: null, optedOut: true, lastContactedDaysAgo: 13 },
  { name: "Lakshmi Pillai", stage: "CONTACTED", source: "in_store", email: gmail("Lakshmi Pillai"), tags: [], assigned: null, lastContactedDaysAgo: 11 },
  { name: "Gaurav Khanna", stage: "WON", source: "in_store", email: gmail("Gaurav Khanna"), tags: ["VIP"], assigned: AGENT_2, lastContactedDaysAgo: 5 },
  { name: "Sanya Bhatia", stage: "NEW", source: "website", email: null, tags: [], assigned: null },
  { name: "Rajesh Yadav", stage: "CONTACTED", source: "csv_import", email: gmail("Rajesh Yadav"), tags: ["Window shopper"], assigned: null, lastContactedDaysAgo: 9 },
  { name: "Mitali Shukla", stage: "LOST", source: "website", email: null, tags: [], assigned: null, optedOut: true, lastContactedDaysAgo: 14 },
  { name: "Varun Chawla", stage: "NEW", source: "csv_import", email: gmail("Varun Chawla"), tags: [], assigned: null },
  { name: "Fatima Sheikh", stage: "QUALIFIED", source: "referral", email: gmail("Fatima Sheikh"), tags: ["Festive shopper"], assigned: AGENT_1, lastContactedDaysAgo: 3 },
  { name: "Imran Qureshi", stage: "CONTACTED", source: "whatsapp", email: null, tags: ["Wholesale"], assigned: null, lastContactedDaysAgo: 7 },
  { name: "Simran Kaur", stage: "WON", source: "in_store", email: gmail("Simran Kaur"), tags: ["VIP", "Repeat buyer"], assigned: AGENT_2, lastContactedDaysAgo: 8 },
  { name: "Gurpreet Singh", stage: "NEW", source: "csv_import", email: null, tags: [], assigned: null },
  { name: "Aisha Khan", stage: "CONTACTED", source: "website", email: gmail("Aisha Khan"), tags: ["New customer"], assigned: null, lastContactedDaysAgo: 1 },
  { name: "Devika Krishnan", stage: "LOST", source: "csv_import", email: null, tags: [], assigned: null, optedOut: true, lastContactedDaysAgo: 12 },
  { name: "Yash Thakur", stage: "NEW", source: "website", email: gmail("Yash Thakur"), tags: ["New customer"], assigned: null },
  { name: "Bhavna Trivedi", stage: "NEW", source: "in_store", email: null, tags: ["New customer"], assigned: null, lastContactedDaysAgo: 1 },
  { name: "Naveen Hegde", stage: "NEW", source: "referral", email: gmail("Naveen Hegde"), tags: ["New customer"], assigned: null },
  { name: "Swati Kulkarni", stage: "NEW", source: "website", email: gmail("Swati Kulkarni"), tags: ["New customer"], assigned: null, lastContactedDaysAgo: 0 },
];

function phoneFor(index: number): string {
  return `+919810000${101 + index}`;
}

// ---------------------------------------------------------------------------
// Conversations (10 — mixed status/assignment/unread, Hinglish threads)
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
    contactIndex: 0, // Ananya Gupta
    status: "open",
    assigned: AGENT_1,
    unread: 2,
    start: hoursAgo(3),
    messages: [
      { dir: "inbound", body: "Hi! Aapke paas Kanjeevaram silk sarees available hain kya?", at: 0 },
      { dir: "outbound", body: "Namaste Ananya ji! 🙏 Haan, abhi 12 naye designs aaye hain Diwali collection mein. Kaunsa colour prefer karengi?", at: 4 },
      { dir: "inbound", body: "Maroon ya deep green mein dikhaiye please", at: 9 },
      { dir: "outbound", body: "Bilkul! Maroon mein 3 gorgeous options hain — ₹8,500 se start. Photos bhejti hoon abhi.", at: 14 },
      { dir: "inbound", body: "Photos mil gayi, maroon wali bahut pasand aayi. Green bhi dikha dena ek baar", at: 150 },
      { dir: "inbound", body: "Aur haan, blouse piece included hai na?", at: 156 },
    ],
    notes: [
      {
        authorUserId: AGENT_1,
        authorName: "Priya Sharma",
        body: "Regular customer — silk lover, size M blouse. Usually buys during festive sales; show new arrivals first.",
      },
    ],
  },
  {
    contactIndex: 5, // Aarav Shah
    status: "open",
    assigned: null,
    unread: 1,
    start: daysAgo(1, 11, 20),
    messages: [
      { dir: "inbound", body: "Bhaiya kal jo kurta liya tha L size, thoda tight hai. Exchange ho jayega?", at: 0 },
      { dir: "outbound", body: "Haan bilkul sir, bill ke saath 7 din ke andar exchange ho jata hai. XL stock mein hai.", at: 6 },
      { dir: "inbound", body: "Great, kal shaam ko aata hoon phir", at: 12 },
      { dir: "inbound", body: "Store kitne baje tak khula hai?", at: 15 },
      { dir: "outbound", body: "Namaste! Hum Mon–Sat 10:30am se 8:30pm tak khule hain, Sunday 12pm–6pm 😊", at: 16 },
    ],
  },
  {
    contactIndex: 6, // Ishita Banerjee
    status: "open",
    assigned: AGENT_2,
    unread: 3,
    start: daysAgo(2, 16, 0),
    messages: [
      { dir: "inbound", body: "Hello! Instagram pe jo teal lehenga dekha tha, wo available hai?", at: 0 },
      { dir: "outbound", body: "Hi Ishita! Haan available hai, size S aur M mein. ₹14,999 with dupatta.", at: 10 },
      { dir: "inbound", body: "M size chahiye. Blouse alteration bhi karte ho?", at: 25 },
      { dir: "outbound", body: "Ji haan, free alteration within 3 days. Aap store aa sakti hain fitting ke liye.", at: 30 },
      { dir: "outbound", body: "Ya phir hum measurements WhatsApp pe bhi le sakte hain 😊", at: 32 },
      { dir: "inbound", body: "Sorry reply nahi kar payi. Kal 5 baje aa rahi hoon fitting ke liye", at: 2850 },
      { dir: "inbound", body: "Ek aur baat — matching jewellery bhi rakhte ho kya?", at: 2852 },
      { dir: "inbound", body: "Aur parking available hai aapke yahan?", at: 2854 },
    ],
  },
  {
    contactIndex: 1, // Rahul Verma
    status: "open",
    assigned: "OWNER", // replaced with org.ownerUserId at runtime
    unread: 0,
    start: daysAgo(3, 12, 30),
    messages: [
      { dir: "inbound", body: "Order #1024 ka kya status hai? Kurta set order kiya tha Monday ko", at: 0 },
      { dir: "outbound", body: "Rahul ji, aapka order pack ho gaya hai. Kal courier pickup hai — Friday tak mil jayega.", at: 8 },
      { dir: "inbound", body: "Theek hai. Tracking number mil sakta hai?", at: 12 },
      { dir: "outbound", body: "Ji, dispatch hote hi tracking number yahin bhej denge.", at: 20 },
      { dir: "outbound", body: "Update: aapka order dispatch ho gaya! Tracking: DTDC D452188732. Friday tak delivery expected 📦", at: 1440 },
    ],
  },
  {
    contactIndex: 15, // Manish Tiwari
    status: "pending",
    assigned: AGENT_1,
    unread: 0,
    start: daysAgo(5, 11, 0),
    messages: [
      { dir: "inbound", body: "Namaste, main Tiwari Garments Gorakhpur se. Aapke cotton kurta sets ka wholesale rate chahiye tha", at: 0 },
      { dir: "outbound", body: "Namaste Manish ji! Wholesale 20+ pieces pe milta hai. Kaunsa range dekh rahe hain aap?", at: 9 },
      { dir: "inbound", body: "50 pieces chahiye, mixed sizes, festive designs", at: 22 },
      { dir: "outbound", body: "50 pcs pe ₹680/piece pad jayega, GST invoice ke saath. Catalogue bhej raha hoon.", at: 30 },
      { dir: "inbound", body: "Rate thoda tight hai bhai, ₹650 ho jaye to aaj hi confirm karta hoon", at: 55 },
      { dir: "outbound", body: "Owner se baat karke batata hoon, kal tak pakka confirm kar dunga 👍", at: 60 },
    ],
    notes: [
      {
        authorUserId: AGENT_1,
        authorName: "Priya Sharma",
        body: "Wholesale buyer from Gorakhpur — 50 pcs cotton kurta sets. Waiting on owner approval for ₹650/pc.",
      },
    ],
  },
  {
    contactIndex: 18, // Anjali Menon
    status: "pending",
    assigned: null,
    unread: 2,
    start: daysAgo(2, 13, 15),
    messages: [
      { dir: "inbound", body: "Hi, kya aap gift wrapping karte hain? Sister ki shaadi ka gift lena hai", at: 0 },
      { dir: "outbound", body: "Hi Anjali! Haan, festive gift packing free hai ₹2,000+ ki purchase pe 🎁", at: 7 },
      { dir: "inbound", body: "Perfect. Silk dupatta gift box mein aa sakta hai?", at: 15 },
      { dir: "inbound", body: "Aur Sunday ko timing kya hai aapki?", at: 17 },
    ],
  },
  {
    contactIndex: 2, // Meera Iyer
    status: "resolved",
    assigned: AGENT_2,
    unread: 0,
    start: daysAgo(10, 17, 0),
    messages: [
      { dir: "inbound", body: "Aapke paas Banarasi dupatta hai? Website pe dekha tha", at: 0 },
      { dir: "outbound", body: "Namaste Meera ji! Haan, pure silk Banarasi dupattas hain — rani pink, gold aur royal blue mein.", at: 5 },
      { dir: "inbound", body: "Rani pink ka price kya hai?", at: 12 },
      { dir: "outbound", body: "₹3,499, pure handwoven zari border ke saath. Aaj sirf 2 pieces bache hain!", at: 16 },
      { dir: "inbound", body: "Ek reserve kar dijiye please, kal aati hoon", at: 24 },
      { dir: "outbound", body: "Done! Aapke naam pe reserve kar diya — kal 8:30pm tak rakh lenge 😊", at: 28 },
      { dir: "inbound", body: "Thank you!", at: 31 },
      { dir: "outbound", body: "Reminder: aapka rani pink Banarasi dupatta aaj ke liye reserved hai ✨", at: 1080 },
      { dir: "inbound", body: "Haan aa rahi hoon 6 baje", at: 1105 },
      { dir: "outbound", body: "Perfect, milte hain!", at: 1108 },
      { dir: "inbound", body: "Dupatta bohot hi sundar hai! Thank you so much ❤️", at: 1500 },
      { dir: "outbound", body: "Dhanyavaad Meera ji! Aapko dekh ke khushi hui. Diwali collection bhi zaroor dekhiyega 🪔", at: 1510 },
    ],
  },
  {
    contactIndex: 9, // Aditya Joshi
    status: "resolved",
    assigned: "OWNER",
    unread: 0,
    start: daysAgo(4, 10, 45),
    messages: [
      { dir: "inbound", body: "Store timing kya hai aaj ki?", at: 0 },
      { dir: "outbound", body: "Namaste! Hum Mon–Sat 10:30am se 8:30pm tak khule hain, Sunday 12pm–6pm 😊", at: 1 },
      { dir: "inbound", body: "Thanks. Nehru jacket ka price range kya hai aapke yahan?", at: 6 },
      { dir: "outbound", body: "Nehru jackets ₹2,199 se ₹5,499 tak — cotton silk aur jacquard dono mein.", at: 11 },
      { dir: "inbound", body: "Theek hai, weekend pe aata hoon. Thanks!", at: 15 },
    ],
  },
  {
    contactIndex: 12, // Pooja Agarwal (opted out)
    status: "resolved",
    assigned: null,
    unread: 0,
    start: daysAgo(6, 19, 0),
    messages: [
      { dir: "outbound", body: "Pooja ji, humara naya festive collection aa gaya hai! Sabhi silk sarees pe special launch offer. Aaj hi visit karein 🪔", at: 0 },
      { dir: "inbound", body: "STOP", at: 34 },
      { dir: "outbound", body: "Aapko aage se koi marketing message nahi bhejenge. Dhanyavaad.", at: 35 },
      { dir: "inbound", body: "Ok", at: 40 },
    ],
  },
  {
    contactIndex: 3, // Vikram Singh
    status: "handoff",
    assigned: null,
    unread: 2,
    start: daysAgo(1, 18, 30),
    messages: [
      { dir: "inbound", body: "Pichle hafte jo saree li thi usme zari ka dhaga nikal raha hai. Ye kya quality hai?", at: 0 },
      { dir: "outbound", body: "Vikram ji, humein khed hai. Kya aap kharab hisse ki photo bhej sakte hain?", at: 5 },
      { dir: "inbound", body: "Photo bhej di hai. ₹9,000 ki saree mein aisa expect nahi tha", at: 18 },
      { dir: "outbound", body: "Aap bilkul sahi keh rahe hain. Ek senior team member aapse jaldi baat karenge.", at: 22 },
      { dir: "inbound", body: "Mujhe replacement ya refund chahiye, simple", at: 45 },
      { dir: "inbound", body: "Aaj shaam tak batao warna consumer forum jaana padega", at: 47 },
      { dir: "outbound", body: "Sir, aapki baat owner tak pahunch gayi hai — aaj 7 baje tak aapko call aayega 🙏", at: 52 },
    ],
    notes: [
      {
        authorUserId: "OWNER",
        authorName: "Owner",
        body: "Refund approved if bill shown. Handle personally — referred by Meera Iyer, escalation risk.",
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
    name: "festive_collection_launch",
    status: "APPROVED",
    content: {
      productName: "Festive Collection",
      campaignAngle: "Launch-week excitement for the new festive collection.",
      header: "Festive collection has arrived ✨",
      body: "Hi {{1}}, humara naya festive collection aa gaya hai! Handpicked sarees, lehengas aur kurta sets — sab kuch is week 15% launch offer ke saath. Jaldi aaiye, best pieces pehle nikal jaate hain!",
      footer: "Reply STOP to unsubscribe",
      buttons: [
        { type: "QUICK_REPLY", text: "Show collection" },
        { type: "QUICK_REPLY", text: "Visit store" },
      ],
      sampleName: "Priya",
      imageTreatment: "Flat-lay of mixed festive pieces on a deep red cloth with marigold accents.",
      notes: "Evergreen launch template — reuse for every seasonal drop.",
    },
  },
  {
    name: "new_arrivals_alert",
    status: "PENDING",
    content: {
      productName: "New Arrivals",
      campaignAngle: "First-look privilege for regulars when fresh stock lands.",
      header: "New arrivals just for you",
      body: "Hi {{1}}, aapke pasand ke naye designs aaye hain — pure cotton kurtas aur silk dupattas fresh stock mein. Pehli pasand aapki ho, isliye sabse pehle aapko bata rahe hain 😊",
      footer: "Reply STOP to unsubscribe",
      buttons: [{ type: "QUICK_REPLY", text: "Show me" }],
      sampleName: "Priya",
      imageTreatment: "Neatly stacked kurtas in daylight near the shop window.",
      notes: "Send within 48h of new stock arriving.",
    },
  },
  {
    name: "weekend_sale_reminder",
    status: "DRAFT",
    content: {
      productName: "Weekend Sale",
      campaignAngle: "Short urgency window: weekend-only discount on ethnic wear.",
      header: "Weekend sale reminder 🛍️",
      body: "Hi {{1}}, is weekend selected ethnic wear pe flat 20% off! Sirf Saturday–Sunday. Apne favourite pieces reserve karne ke liye reply karein.",
      footer: "Reply STOP to unsubscribe",
      buttons: [
        { type: "QUICK_REPLY", text: "Reserve now" },
        { type: "QUICK_REPLY", text: "See catalogue" },
      ],
      sampleName: "Priya",
      imageTreatment: "Bright sale rack with a handwritten '20% off' card.",
      notes: "Draft — finalize discount % with owner before submitting.",
    },
  },
  {
    name: "back_in_stock_promo",
    status: "REJECTED",
    rejectionReason:
      'Rejected by Meta review (simulated): promotional claim "guaranteed lowest price" violates advertising policy. Rephrase the claim and resubmit.',
    content: {
      productName: "Back in Stock",
      campaignAngle: "Restock alert for sold-out bestsellers.",
      header: "Back in stock — guaranteed lowest price",
      body: "Hi {{1}}, jo bestseller sarees sold out thi wo wapas aa gayi hain — guaranteed lowest price in the market! Aaj hi apna piece book karein, dobara stock ka bharosa nahi.",
      footer: "Reply STOP to unsubscribe",
      buttons: [{ type: "QUICK_REPLY", text: "Book mine" }],
      sampleName: "Priya",
      imageTreatment: "Close-up of the restocked saree fabric with zari detail.",
      notes: "Needs rewording — remove the price-guarantee claim.",
    },
  },
];

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

const DRAFT_CAMPAIGN_CONTENT: CampaignContent = {
  productName: "Banarasi Silk Dupatta",
  campaignAngle: "Festive-season exclusivity: handwoven pieces in limited stock.",
  header: "Handwoven Banarasi has arrived ✨",
  body: "Hi {{1}}, our new Banarasi silk dupattas just came in — handwoven, rich zari work, and only 20 pieces this season. Drop by this week and take 15% off your pick. Don't miss the festive colours!",
  footer: "Reply STOP to unsubscribe",
  buttons: [
    { type: "QUICK_REPLY", text: "Show me colours" },
    { type: "QUICK_REPLY", text: "Reserve one" },
  ],
  sampleName: "Priya",
  imageTreatment: "Drape the dupatta over a warm wooden surface in soft daylight so the zari catches the light.",
  notes: "Festive weekends convert best — send Thursday evening.",
};

const SENT_CAMPAIGN_CONTENT: CampaignContent = {
  productName: "Silk Saree Collection",
  campaignAngle: "Diwali urgency: flat 20% off all silk sarees for regulars.",
  header: "Diwali Dhamaka is here 🪔",
  body: "Hi {{1}}, Diwali ki taiyari shuru! All silk sarees — Kanjeevaram, Banarasi, Tussar — flat 20% off this week only. Purani customer ho toh ek chhota surprise gift bhi. Stock limited hai, jaldi aaiye!",
  footer: "Reply STOP to unsubscribe",
  buttons: [
    { type: "QUICK_REPLY", text: "Show offers" },
    { type: "QUICK_REPLY", text: "Book a visit" },
  ],
  sampleName: "Priya",
  imageTreatment: "Sarees fanned out around a lit brass diya on a dark backdrop.",
  notes: "Sent Diwali week — best performing campaign so far.",
};

const SCHEDULED_CAMPAIGN_CONTENT: CampaignContent = {
  productName: "Cotton Kurta Sets",
  campaignAngle: "Weekend flash sale on breathable everyday cotton sets.",
  header: "Weekend flash sale ⚡",
  body: "Hi {{1}}, sirf is weekend — cotton kurta sets pe flat 25% off! Office wear se festive tak, sab styles available. Saturday 10:30 baje se store pe milte hain 😊",
  footer: "Reply STOP to unsubscribe",
  buttons: [
    { type: "QUICK_REPLY", text: "Show styles" },
    { type: "QUICK_REPLY", text: "Reserve my size" },
  ],
  sampleName: "Priya",
  imageTreatment: "Pastel cotton sets hanging on a wooden rack in bright daylight.",
  notes: "Scheduled for tomorrow morning — audience: festive shoppers.",
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
    { userId: AGENT_1, email: "priya.sharma@nudge.demo", displayName: "Priya Sharma", role: "AGENT" as const },
    { userId: AGENT_2, email: "arjun.mehta@nudge.demo", displayName: "Arjun Mehta", role: "AGENT" as const },
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
      name: "Regular customers (demo)",
      memberIndexes: CONTACTS.map((_, i) => i).filter(
        (i) => optedIn(i) && (CONTACTS[i].tags.includes("Repeat buyer") || CONTACTS[i].stage === "WON" || i < 12)
      ),
    },
    {
      name: "Festive shoppers",
      memberIndexes: CONTACTS.map((_, i) => i).filter(
        (i) => optedIn(i) && CONTACTS[i].tags.includes("Festive shopper")
      ),
    },
    {
      name: "VIP customers",
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
  // One standalone contact note (Gaurav Khanna, VIP) from Arjun.
  const body =
    "Prefers WhatsApp updates over calls. Anniversary in November — good gifting window.";
  const contactId = contactIds[25];
  const found = await prisma.note.findFirst({
    where: { orgId, contactId, conversationId: null, body },
  });
  if (!found) {
    await prisma.note.create({
      data: { orgId, contactId, authorUserId: AGENT_2, authorName: "Arjun Mehta", body },
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
  // 1) DRAFT — the original Banarasi demo campaign, kept and refreshed.
  const draftProductId = await ensureProduct(
    prisma, orgId,
    "Banarasi Silk Dupatta",
    "Handwoven Banarasi silk dupatta, festive stock"
  );
  const draft = await prisma.campaign.findFirst({
    where: { orgId, name: "Banarasi Silk Dupatta" },
  });
  if (!draft) {
    await prisma.campaign.create({
      data: {
        orgId,
        productId: draftProductId,
        name: "Banarasi Silk Dupatta",
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

  // 2) SENT — Diwali campaign with ~25 realistic per-recipient Message rows.
  const sentProductId = await ensureProduct(
    prisma, orgId,
    "Silk Saree Collection",
    "Kanjeevaram, Banarasi and Tussar silk sarees — Diwali stock"
  );
  let sent = await prisma.campaign.findFirst({
    where: { orgId, name: "Diwali Dhamaka Sale" },
  });
  if (!sent) {
    sent = await prisma.campaign.create({
      data: {
        orgId,
        productId: sentProductId,
        name: "Diwali Dhamaka Sale",
        status: "SENT",
        content: SENT_CAMPAIGN_CONTENT,
        audienceId: audienceIds.get("Regular customers (demo)") ?? null,
        createdAt: daysAgo(6, 15, 0),
      },
    });
  }

  // Campaign-scoped template row (the real flow approves one before sending).
  const sentTplName = "diwali_dhamaka_sale";
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
        metaMessageId: failed ? null : `sim-wamid-diwali-${k + 1}`,
        errorCode: failed ? "131026" : null,
        costMinorUnits: failed ? null : MARKETING_COST_PAISE,
        sentAt: failed ? null : sentAt,
        createdAt: sentAt,
      },
      update: {},
    });
  }

  // 3) SCHEDULED — weekend flash sale going out tomorrow morning.
  const scheduledProductId = await ensureProduct(
    prisma, orgId,
    "Cotton Kurta Sets",
    "Everyday breathable cotton kurta sets, office to festive"
  );
  const tomorrow = new Date(NOW);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 30, 0, 0);
  const scheduled = await prisma.campaign.findFirst({
    where: { orgId, name: "Weekend Flash Sale" },
  });
  if (!scheduled) {
    await prisma.campaign.create({
      data: {
        orgId,
        productId: scheduledProductId,
        name: "Weekend Flash Sale",
        status: "SCHEDULED",
        content: SCHEDULED_CAMPAIGN_CONTENT,
        audienceId: audienceIds.get("Festive shoppers") ?? null,
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
      name: "Store hours FAQ",
      description: "Replies instantly when a customer asks about store hours or timings.",
      enabled: true,
      trigger: "keyword",
      triggerConfig: {
        keywords: ["hours", "timing", "kitne baje", "kab khulta", "khula hai"],
        match: "contains",
      },
      steps: [
        {
          order: 1,
          kind: "send_message",
          config: {
            body: "Namaste! Hum Mon–Sat 10:30am se 8:30pm tak khule hain, Sunday 12pm–6pm 😊",
          },
        },
      ],
    },
    {
      name: "Welcome new customers",
      description: "Greets every new contact with the festive launch template and tags them.",
      enabled: true,
      trigger: "contact_created",
      triggerConfig: {},
      steps: [
        {
          order: 1,
          kind: "send_template",
          config: {
            templateId: templateIds.get("festive_collection_launch") ?? null,
            templateName: "festive_collection_launch",
          },
        },
        {
          order: 2,
          kind: "add_tag",
          config: {
            tagId: tagIds.get("New customer") ?? null,
            tagName: "New customer",
          },
        },
      ],
    },
    {
      name: "Route VIPs to Priya",
      description: "When the VIP tag is added, assigns the contact to Priya and bumps the stage.",
      enabled: false,
      trigger: "tag_added",
      triggerConfig: { tagId: tagIds.get("VIP") ?? null, tagName: "VIP" },
      steps: [
        {
          order: 1,
          kind: "assign_agent",
          config: { userId: AGENT_1, displayName: "Priya Sharma" },
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

  // Run history on "Store hours FAQ" (2 completed + 1 failed, with step logs).
  const faqId = idByName.get("Store hours FAQ");
  if (faqId) {
    const existingRuns = await prisma.automationRun.count({
      where: { automationId: faqId },
    });
    if (existingRuns === 0) {
      const runs = [
        {
          contactIndex: 9, // Aditya Joshi — resolved thread with the auto-reply
          status: "COMPLETED" as const,
          currentStep: 1,
          at: daysAgo(4, 10, 46),
          log: [
            {
              step: 1,
              kind: "send_message",
              status: "ok",
              detail: "Sent store-hours reply within the 24h service window",
              at: daysAgo(4, 10, 46).toISOString(),
            },
          ],
        },
        {
          contactIndex: 5, // Aarav Shah — open thread, hours question answered
          status: "COMPLETED" as const,
          currentStep: 1,
          at: daysAgo(1, 11, 36),
          log: [
            {
              step: 1,
              kind: "send_message",
              status: "ok",
              detail: "Sent store-hours reply within the 24h service window",
              at: daysAgo(1, 11, 36).toISOString(),
            },
          ],
        },
        {
          contactIndex: 18, // Anjali Menon — window had closed, send failed
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
      vertical: "retail",
      businessName: "Aarav Textiles",
      businessInfo:
        "HOURS:\nMon–Sat 10am–8pm, Sun closed\n\nSERVICES:\nSarees, lehengas, kurta sets, festive collection\n\nPRICES:\nSarees from ₹1,200; lehengas from ₹4,500\n\nBOOKING & POLICIES:\nAppointments preferred for styling; walk-ins welcome.",
      tone: "Warm, friendly, and concise",
      doNots: "Never promise same-day delivery.",
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
    { name: "Priya Sharma", contactId: contactIds[0], requestedFor: "Saturday 2pm", status: "confirmed", offsetHours: 20, event: "sim-cal-demo1" },
    { name: "Rahul Verma", contactId: contactIds[1], requestedFor: "yesterday 4pm", status: "confirmed", offsetHours: -3, event: "sim-cal-demo2" },
    { name: "Anjali Rao", contactId: contactIds[2], requestedFor: "Monday 11am", status: "no_show", offsetHours: -26, event: null as string | null },
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
      vertical: org.vertical ?? "boutique",
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

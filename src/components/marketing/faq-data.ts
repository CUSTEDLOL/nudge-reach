// FAQ content — plain data module so server components (JSON-LD) can
// import it without pulling in the client accordion.
export const FAQS: { q: string; a: string }[] = [
  {
    q: "Do I need a WhatsApp Business account to start?",
    a: "No. You can explore the entire product in test mode with no account at all — nothing you do reaches a real customer until you say so. When you're ready to go live, you connect a WhatsApp Business number through the official Cloud API, and we walk you through every step.",
  },
  {
    q: "What do the plans actually include?",
    a: "Entry at ₹1,499 a month is an AI chatbot trained on your business — it answers customer questions around the clock and sends marketing templates, but it does not act. Starter at ₹4,499 adds the full workspace: lead capture, the shared team inbox, contacts, campaigns and a website button. Growth at ₹7,499 lets the AI act — booking into your real calendar, sending payment links, chasing quiet leads and no-shows, plus lead scoring, CRM sync and the developer API. Pro at ₹14,999 adds the voice front desk, custom actions into your own systems and the option to bring your own AI key.",
  },
  {
    q: "Can I try it before paying?",
    a: "Yes. Every new workspace gets a 7-day trial on the Growth plan with no card. At the end you choose a plan; there is no automatic charge. If you don't subscribe, your history stays readable and exportable while the AI pauses.",
  },
  {
    q: "Is there a setup fee?",
    a: "No. Setting up your AI Front Desk is part of the subscription. We help you get your knowledge base, templates and integrations working, and there is no separate implementation charge.",
  },
  {
    q: "How much do messages actually cost?",
    a: "Meta charges per conversation, billed to you directly by Meta with no Nudge markup. We show you the exact ₹ estimate before you hit send, so there are never any surprises on your bill.",
  },
  {
    q: "Is this compliant with WhatsApp's rules?",
    a: "Yes, by design. Nudge only sends marketing to contacts who have opted in, uses Meta-approved templates outside the 24-hour reply window, and handles STOP requests permanently and automatically. Compliance is enforced in code, not left to a setting.",
  },
  {
    q: "Can my whole team work from it?",
    a: "Yes. The shared inbox supports seats, assignment, internal notes and tags, so your front desk and sales staff work the same conversations without stepping on each other. Starter includes 3 seats, Growth 10 and Pro 25. On Growth and above you can also limit a staff member to specific WhatsApp numbers.",
  },
  {
    q: "Will it work for my type of business?",
    a: "It fits any business that wins customers through enquiries and appointments on WhatsApp — clinics, dental and aesthetic practices, salons, real estate, local services, restaurants and retail. If leads reach you on WhatsApp and someone has to answer them, it fits.",
  },
  {
    q: "How long does setup take?",
    a: "Most businesses are live within a day. You teach the AI by answering a short questionnaire or by importing your website and Google listing, and connecting your number is a short guided step we do with you on a call.",
  },
  {
    q: "Is my data safe?",
    a: "Your conversations and customer data stay yours and are isolated per workspace at the database level. We never sell or share your data, full stop.",
  },
];

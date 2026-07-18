// FAQ content — plain data module so server components (JSON-LD) can
// import it without pulling in the client accordion.
export const FAQS: { q: string; a: string }[] = [
  {
    q: "Do I need a WhatsApp Business account to start?",
    a: "No. You can explore the entire product in simulation mode with no account at all. When you're ready to send real messages, you connect a WhatsApp Business number through the official Cloud API, and we walk you through every step.",
  },
  {
    q: "Is this compliant with WhatsApp's rules?",
    a: "Yes, by design. Nudge only messages contacts who have opted in, uses Meta-approved templates, and handles STOP requests automatically. Compliance is baked into every broadcast and automation, not bolted on.",
  },
  {
    q: "How much do messages actually cost?",
    a: "Meta charges per conversation. We pass that through at cost with no markup, and show you the exact ₹ estimate before you hit send, so there are never any surprises on your bill.",
  },
  {
    q: "Can my whole team work from it?",
    a: "Absolutely. The shared inbox supports seats, assignment, internal notes and live presence, so sales and support collaborate on the same conversations without stepping on each other.",
  },
  {
    q: "Will it work for my type of business?",
    a: "Nudge is built for SME retail and D2C: apparel, jewellery, food, décor, electronics, services and more. If your customers reach you on WhatsApp, it fits.",
  },
  {
    q: "How long does setup take?",
    a: "Most shops are live the same day. The photo → campaign generator works in minutes, and connecting your number is a short guided step.",
  },
  {
    q: "Is my data safe?",
    a: "Your conversations and customer data stay yours and are isolated per organisation. We never sell or share your data, full stop.",
  },
  {
    q: "Can I really start free?",
    a: "Yes. The Free plan gives you a WhatsApp number, 250 contacts, 500 campaign messages a month, the shared inbox with AI drafts, 2 automations and 2 seats. No card, no expiry. Upgrade inside the app only when you hit a limit.",
  },
];

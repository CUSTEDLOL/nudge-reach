# Comparison Story Bento Design

## Goal

Replace the dense comparison table with a low-text visual story that matches the landing page's existing neo-brutalist bento language and communicates the operating-model difference in about five seconds.

## Core message

**The difference isn't more features. It's who does the work.**

The scene begins with one late-night enquiry: “Hi, is Saturday available?” The Nudge card shows the complete outcome—reply, real-calendar booking, payment, and follow-up—while three compact cards explain the alternative operating models without denying their capabilities.

## Layout

Desktop uses an asymmetric two-column composition: a large green Nudge card on the left and three smaller competitor cards stacked on the right. Mobile becomes a simple vertical stack with Nudge first. Nothing scrolls sideways and no content depends on interaction.

The large Nudge card contains four sticker-like visual steps connected by a route:

1. Replied
2. Calendar checked
3. Deposit received
4. Follow-up ready

The alternatives contain one dominant icon, one concise description, and one ownership badge:

- **Meta's AI:** A capable agent for incoming conversations. `You connect + oversee`
- **CRM tools:** Powerful software for building WhatsApp workflows. `Your team or partner operates`
- **Human receptionist:** A capable person behind the desk. `You hire + train + cover shifts`

The named CRM examples appear once: `WATI · AiSensy · Interakt`.

## Visual language

Reuse the exact motifs already established by `FeatureScenes` and `IndustryWordSearch`: saturated gradients, `rounded-[1.75rem]`, two-pixel ink borders, hard offset shadows, giant faded uppercase backdrop words, bold uppercase display type, and smaller sticker surfaces. Nudge uses the flagship lime gradient and ghost word `RUNS`; alternatives use blue, purple, and orange with `ASSISTS`, `TOOLS`, and `SHIFT`.

Cards may lift slightly on hover, matching the feature-card motion, but the comparison is fully legible when static and under reduced motion.

## Credibility and accessibility

The copy compares who configures and operates each option, not blanket feature availability. All text uses high-contrast ink colors on bright cards. Decorative icons and route lines are hidden from assistive technology; headings and article labels provide the reading structure. The mobile stack preserves source order and requires no swipe gesture.

## Testing

A render-contract test asserts the headline, enquiry, complete Nudge outcome, three alternatives, ownership badges, named CRM tools, accessible article structure, no table markup, no horizontal-scroll prompt, and the four visual steps. Full tests, TypeScript, lint, production build, and desktop/mobile screenshots gate completion.

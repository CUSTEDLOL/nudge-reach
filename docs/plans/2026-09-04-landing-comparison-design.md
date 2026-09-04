# Landing Comparison Redesign

## Goal

Replace the current game-like competitor leaderboard with a direct, readable comparison table modeled on the clarity of the supplied Wati reference while preserving Nudge's own visual identity and positioning.

## Content

The section headline is **“Why businesses choose Nudge”** with the explanation **“Other tools help your team run WhatsApp. Nudge runs the front desk for you.”** The four comparison columns are:

1. Nudge AI Front Desk
2. Meta's free AI
3. CRM tools — WATI, AiSensy, Interakt
4. Human receptionist

Rows describe outcomes rather than abstract product features: answering enquiries, real-calendar booking, following up quiet leads, payment links, no-show recovery, setup and training, after-hours coverage, and who operates the system. Claims stay aligned with `AGENTS.md` and `docs/STRATEGY.md`: Nudge is differentiated by real actions, outbound revenue generation, and done-for-you service.

## Visual design

Use one semantic comparison table on the existing pale-green section background. Nudge is the single saturated green column; alternatives use quiet white or neutral surfaces. Cells contain an icon plus a short, plain-language statement. Remove scores, rankings, filters, reordering, power bars, and all game-card decoration.

Desktop shows the full table. On narrow screens the table lives in a labeled horizontal-scroll region with a minimum width, strong column headers, and a sticky outcome column so the row meaning remains visible. The existing `#compare` anchor remains unchanged.

## Accessibility and testing

Use native table elements, scoped column headers, scoped row headers, accessible icon labels, and visible focus/scroll affordances. A focused static test asserts the headline, four comparison categories, eight outcome rows, semantic table markup, preserved anchor, and removal of the old scorecard/filter language. The full test, lint, TypeScript, and build gates run before handoff.

# Competitor Decision Ledger Design

## Goal

Replace the rejected comparison bento with a readable competitor analysis that
answers two buyer questions at a glance:

1. What does each option handle?
2. What work and responsibility remain with the buyer?

The section should feel like one editorial comparison board, not four marketing
cards and not a dense software-feature spreadsheet.

## Message hierarchy

- Eyebrow: `COMPETITOR ANALYSIS`
- Headline: `FOUR WAYS TO RUN WHATSAPP.`
- Supporting line: `Compare what each handles, what stays with you, and who it fits.`
- Column labels: `OPTION`, `WHAT IT HANDLES`, `WHAT YOU STILL OWN`, `BEST FOR`

The board compares four equally visible options:

| Option | What it handles | What you still own | Best for |
| --- | --- | --- | --- |
| **Nudge AI Front Desk** — Managed service | Replies, bookings, deposits and quiet-lead recovery. | Set the rules. Nudge configures and runs it. | Owners who want the outcome managed. |
| **Meta Business Agent** — Native WhatsApp AI | Questions, recommendations, qualification and appointments. | Setup, connected workflows and ongoing oversight. | Simple AI inside WhatsApp. |
| **WhatsApp CRM tools** — WATI · AiSensy · Interakt | Inbox, campaigns, AI agents and automations. | Workflow design, integrations and daily operation. | Teams that want platform control. |
| **Human receptionist** — Traditional hire | Conversations, exceptions and manual follow-up. | Hiring, training, scheduling and cover. | Businesses needing human judgment. |

A note below the board says: `Capabilities, services and pricing vary by
provider, plan and market.`

The copy deliberately avoids checks, crosses, scores, absolutes and unsupported
feature denials. Competitors now advertise overlapping AI, booking, payment,
integration and follow-up capabilities; Nudge is differentiated by the managed
operating model.

## Desktop layout

At 1024px and wider, render one semantic table inside a framed board. The four
columns use roughly 24%, 29%, 28% and 19% of the board. A dark ink header strip
makes the analytical structure unmistakable. Rows use generous padding,
15–16px body type and strong horizontal rules. The Nudge row receives a
restrained pale-green background and a green left accent; every other option
keeps equal structural weight.

The only motifs retained from the rest of the landing page are the strong
display headline, two-pixel outer ink border, large rounded outer corner and one
hard offset shadow. There are no card gradients, ghost words, nested tiles,
message bubble, stickers or hover movement.

## Mobile and tablet layout

Below 1024px, the same shared data renders as one continuous vertical ledger.
Each competitor is a row separated by an ink rule, not an independent card. Its
name and category appear first, followed by three clearly labelled definition
values: `HANDLES`, `YOU STILL OWN`, and `BEST FOR`.

At 640–1023px the three values form columns. Below 640px they stack. Body text is
at least 16px on phones, labels are at least 12px, and no element uses a fixed
minimum width or horizontal scrolling. Nudge remains first and highlighted.

## Semantics and accessibility

- Desktop uses a real `<table>` with a caption, scoped column headers and scoped
  row headers.
- Mobile uses labelled sections with definition lists.
- Responsive `display: none` ensures assistive technology encounters only the
  active representation at a given viewport.
- All essential text uses at least 4.5:1 contrast and is never placed over
  decoration.
- No meaning relies on colour, icons, hover or JavaScript.

## Testing

A server-rendered contract test asserts the shared headings, four options,
approved concise copy, credibility note, table semantics, mobile definition
labels, stable `#compare` anchor and absence of the rejected bento/table-clutter
patterns. Browser checks cover 1440px, 1024px, 768px, 390px and 320px widths and
must show no horizontal overflow.

# Deploy the Waitlist — Runbook

The waitlist is built into your existing Next/Supabase app: a public page at **`/waitlist`** posting to **`/api/waitlist`**, storing rows in a new **`WaitlistSignup`** table. Final deploy needs your accounts (Supabase DB + Vercel login), so run these on your machine.

## What was added
- `prisma/schema.prisma` — new `WaitlistSignup` model.
- `app/api/waitlist/route.ts` — public POST endpoint (zod-validated, phone normalized, Prisma insert).
- `app/waitlist/page.tsx` + `waitlist-form.tsx` + `waitlist.css` — the public landing page.
- `lib/supabase/proxy-session.ts` — added `/waitlist` and `/api/waitlist` to `PUBLIC_PATHS` so signed-out visitors aren't bounced to `/login`.

## Steps

```bash
# 1. From the repo root, regenerate the Prisma client + create the table.
#    (Additive change — no data loss. Reads DATABASE_URL/DIRECT_URL from .env.)
npm run db:push          # runs `prisma db push` (also regenerates the client)

# 2. Build locally to confirm everything compiles (catches type errors).
npm run build

# 3. Run locally and eyeball the page + a test signup.
npx next start           # then open http://localhost:3000/waitlist
#    Submit the form once; confirm you get the success state and a row appears:
npm run db:studio        # open the WaitlistSignup table to see your test row

# 4. Deploy to production.
npx vercel --prod --yes  # uses your linked `nudge-reach` project
```

## After deploy
- Visit `https://nudge-reach.vercel.app/waitlist` and submit a real test signup.
- **(Recommended) Enable RLS on the new table** for consistency with your other tables (the Supabase Data API exposes `public` tables to the publishable key by default; Prisma, as table owner, still works). In the Supabase SQL editor:
  ```sql
  alter table "WaitlistSignup" enable row level security;
  -- no policies = no access via the publishable key; server-side Prisma is unaffected.
  ```
- Point people at `/waitlist` (or set up a cleaner domain / redirect if you want a bare URL for flyers and Reels).

## Reading your signups
- Quick view: `npm run db:studio` → `WaitlistSignup`.
- Or add a tiny authenticated admin view later if you want it in-app.

## Notes
- The endpoint is intentionally public and unauthenticated (it's a marketing form). It validates input and never leaks DB errors. If you later see spam, add a honeypot field or a rate limit.
- The standalone `gtm/landing/index.html` is now superseded by the in-app `/waitlist` route, but kept as a reference / portable backup you can host anywhere.

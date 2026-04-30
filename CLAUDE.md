# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build (use to verify no compilation errors)
npm start        # start production server (after build)
```

No linter or test suite is configured.

## Architecture

Single Next.js 16 App Router project — backend API routes and frontend live in the same codebase.

**Data flow:**
1. Happier Leads fires `POST /api/webhook/happierleads` when a new visitor is identified
2. Webhook handler deduplicates and inserts into Neon PostgreSQL
3. Frontend polls `GET /api/leads` every 10 seconds and renders the table

**Database:** Neon PostgreSQL via `@neondatabase/serverless`. The client is a single tagged-template `sql` function exported from `src/lib/db.js`. All queries use this directly — no ORM.

**Styling:** Pure CSS using the Growleads/signal-tracker design system (`src/styles/reference.css`). All design tokens are CSS custom properties on `:root`. App-specific additions are in `src/styles/custom.css`. No Tailwind, no CSS modules.

**Routes:**
- `app/page.jsx` — Overview (stat cards, pipeline status, recent 5 leads)
- `app/leads/page.jsx` — Leads page (full table, tabs/search/filter, click-to-expand rows, Export CSV)
- `app/login/page.jsx` — password gate (password: `Growleads@admin`, sets `gl_session` cookie)

**Component model:**
- `layout.jsx` — server component; imports all CSS; renders `<ClientLayout>`
- `ClientLayout.jsx` — client wrapper; manages sidebar collapsed/open state, `app-mounted` class to prevent hydration flash
- `Sidebar.jsx` — collapsible nav; defaults collapsed; auto-collapses below 1100px; hamburger drawer on mobile (≤640px)
- `leads/page.jsx` — owns `expandedId` state; detail panel renders outside the `<table>` in `.lead-detail-outer` so it never scrolls with the table

## Webhook Reliability Rules

**The webhook is the only data ingestion path. If it breaks, leads are lost permanently.**

Rules that must never be violated when touching `src/app/api/webhook/happierleads/route.js` or `src/lib/db.js`:

1. **`WEBHOOK_SECRET` is optional by design.** If it is not set, the webhook accepts all requests and logs a warning. Never make it hard-required (no `return 500` when the env var is absent). Doing so killed ingestion for a full day (2026-04-29).

2. **Never set `WEBHOOK_SECRET` in Vercel without simultaneously updating the HL webhook URL.** The URL must include `?secret=<value>`. Both changes must happen together or ingestion breaks immediately.

3. **DB errors in the dedup check must return `200`.** A `500` triggers Happier Leads retry storms. The only exception is the final INSERT, where `500` is correct (lets HL retry until the DB recovers).

4. **After any security-related change to the webhook route, verify it still works** by sending a test webhook from the Happier Leads automation panel and confirming a new lead appears in the dashboard.

5. **If `DATABASE_URL` is ever missing from Vercel env vars**, `neon()` throws at module load and every request returns `500`. Vercel Logs will show a module initialization error. Fix: re-add `DATABASE_URL` to Vercel environment and redeploy.

## Key Constraints

**Webhook payload is confirmed** — first real webhook was received 2026-04-22. See `docs/3-single-source-of-truth.md` for the full payload structure. Extraction keys are already correct in the webhook route.

**Dedup is layered** — the webhook handler checks for duplicates in order: Happier Leads ID → email → LinkedIn URL → full\_name+company\_name. Always returns `200` even for duplicates (prevents Happier Leads from retrying).

**Production URL** — custom domain `https://websitevisitors.growleads.io` (Vercel alias `https://happier-leads-automation.vercel.app` still works). Webhook is configured to the custom domain URL: `https://websitevisitors.growleads.io/api/webhook/happierleads`. ngrok is no longer needed.

**Password gate** — all app routes (except `/login` and `/api/*`) require a `gl_session` cookie set by `POST /api/auth/login`. Password: `Growleads@admin`. Cookie is persistent (httpOnly, SameSite: strict, maxAge: 30 days).

## Database Setup

Schema is **already created** in Neon production. For reference (e.g. if recreating from scratch):

```sql
CREATE TABLE leads (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at          TIMESTAMPTZ DEFAULT now(),
  happier_leads_id     TEXT        UNIQUE,
  first_name TEXT, last_name TEXT, full_name TEXT, email TEXT, linkedin_url TEXT,
  company_name TEXT, company_domain TEXT, company_logo_url TEXT,
  lead_type TEXT, fit_score NUMERIC, engagement_score NUMERIC, activity_at TIMESTAMPTZ,
  pushed_to_smart_lead BOOLEAN DEFAULT false, pushed_at TIMESTAMPTZ,
  raw_payload JSONB NOT NULL
);
CREATE INDEX leads_received_at_idx ON leads(received_at DESC);
CREATE INDEX leads_email_idx ON leads(email) WHERE email IS NOT NULL;
CREATE INDEX leads_linkedin_idx ON leads(linkedin_url) WHERE linkedin_url IS NOT NULL;
```

## Docs

- `docs/1-what-we-are-building.md` — product overview
- `docs/2-how-we-are-building.md` — architecture details
- `docs/3-single-source-of-truth.md` — schema, API contracts, env vars
- `docs/4-context.md` — **read this first when resuming work** — running changelog of every change made

**Rule:** After every change, add a dated entry to `docs/4-context.md`:
```
## YYYY-MM-DD — [description]
- What changed: ...
- Why: ...
- Files affected: ...
```
Also update `docs/3-single-source-of-truth.md` if schema or API contracts change.

## HeyReach Integration (Push — live)

The "Push to HeyReach" button on the Leads page calls `POST /api/leads/[id]/push`, which pushes the lead to a HeyReach campaign via `POST https://api.heyreach.io/api/public/campaign/AddLeadsToCampaignV2`. Auth uses `HEYREACH_API_KEY` env var (`X-API-KEY` header). Also requires `Accept: text/plain` header.

The DB columns are `pushed_to_smart_lead` / `pushed_at` (legacy names — functionally mean "pushed to HeyReach"). The campaign picker loads IDs from `/api/heyreach/campaign-ids` and campaign details from `/api/heyreach/campaigns`.

**Re-push:** There is no 409 block — the same lead can be pushed to HeyReach multiple times (supports re-engagement campaigns). The UI shows "✓ Re-push" for already-pushed leads; clicking it opens the campaign picker again.

**Fields sent to HeyReach:** `firstName`, `lastName`, `companyName`, `position`, `emailAddress`, `profileUrl` (LinkedIn), `location` (city/state/country from `raw_payload.contact.geo`), `summary` (LinkedIn headline from `raw_payload.contact.headline`).

**Auto-push (live):** Every new lead is automatically pushed to the Universe campaign (`HEYREACH_CAMPAIGN_ID=413857`) immediately after INSERT in the webhook route. The push is guarded by `HEYREACH_CAMPAIGN_ID` and `HEYREACH_API_KEY` env vars — if either is absent, auto-push is silently skipped. Failures are logged but never fail the webhook (lead stays in DB, `pushed_to_smart_lead` remains `false` for manual retry). Auto-push is intentionally in the INSERT path only — duplicates never get re-pushed automatically.

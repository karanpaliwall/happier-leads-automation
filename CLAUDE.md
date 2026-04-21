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
3. Frontend (`page.jsx`) polls `GET /api/leads` every 30 seconds and renders the table

**Database:** Neon PostgreSQL via `@neondatabase/serverless`. The client is a single tagged-template `sql` function exported from `src/lib/db.js`. All queries use this directly — no ORM.

**Styling:** Pure CSS using the Growleads/signal-tracker design system (`src/styles/reference.css`). All design tokens are CSS custom properties on `:root`. App-specific additions are in `src/styles/custom.css`. No Tailwind, no CSS modules.

**Component model:**
- `layout.jsx` — server component; imports all CSS; renders `<Sidebar>`
- `page.jsx` — client component (`'use client'`); owns fetch + pagination + filter state
- `Sidebar.jsx`, `LeadsTable.jsx` — client components (use `usePathname` / event handlers)
- `StatsBar.jsx` — server-compatible (pure props, no hooks)

## Key Constraints

**Webhook payload fields are unknown** — Happier Leads API docs are behind auth. The webhook route (`src/app/api/webhook/happierleads/route.js`) does best-effort extraction with multiple fallback key names. After the first real webhook fires, run `SELECT raw_payload FROM leads ORDER BY received_at DESC LIMIT 1;` in Neon to see the actual structure, then update the extraction keys.

**Dedup is layered** — the webhook handler checks for duplicates in order: Happier Leads ID → email → LinkedIn URL → full\_name+company\_name. Always returns `200` even for duplicates (prevents Happier Leads from retrying).

**ngrok URL changes on restart** — each `ngrok http 3000` gives a new public URL. After restarting ngrok, update the webhook URL in Happier Leads → Automations → "automation" card.

## Database Setup

Schema has not been created yet. Run this in the Neon SQL console (console.neon.tech) before first use:

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

## Smart Lead Integration (Phase 2 — not yet built)

The `pushed_to_smart_lead` / `pushed_at` columns and the disabled "Push to Smart Lead" button in `LeadsTable.jsx` are placeholders. When ready, add a `PATCH /api/leads/[id]/push` route that calls Smart Lead's API and updates those columns.

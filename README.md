# Happier Leads Automation

**Live:** [https://happier-leads-automation.vercel.app](https://happier-leads-automation.vercel.app)

A self-hosted pipeline that captures identified website visitors from [Happier Leads](https://happierleads.com) via webhook, stores them in Neon PostgreSQL, and displays them in a real-time dashboard with full lead detail, fit score breakdown, engagement scoring, and SmartLead campaign tracking.

## What it does

When Happier Leads identifies a visitor on your website, it fires a webhook to this app. The app deduplicates the lead, stores it in Neon PostgreSQL, and shows it in the dashboard within seconds.

```
Website visitor → Happier Leads identifies them
    → POST /api/webhook/happierleads
    → Deduplicate + store in Neon PostgreSQL
    → Dashboard auto-refreshes every 10s
```

## Features

- **Password protected** — Login gate on all app routes; session cookie expires on browser close; webhook stays public
- **Overview dashboard** — Stat cards (total leads, new today with Exact/Suggested breakdown, avg fit score, avg engagement), pipeline status, and an analytics chart with 24h / 7d / custom date-range filters
- **Full lead details** — Click any row to expand contact info, company details, fit score breakdown, visit intelligence, and UTM attribution — instant, no extra fetch
- **Fit Score & Engagement** — Fit score summed from Happier Leads' ICP criteria; engagement derived from visit count and time on site (0–20 scale)
- **Time-based filters** — 24h and 7d quick toggles + a custom calendar date-range picker on the Leads page
- **Export CSV** — Exports all leads matching the active filters (not just current page) with 30 columns including contact, company, visit, and UTM data
- **Campaigns page** — SmartLead campaign pipeline view (Phase 2 — live data sync coming)
- **Layered deduplication** — checks HL ID → email → LinkedIn → name+company before inserting; retries on Neon cold starts
- **Collapsible sidebar** — collapses to icon-only rail; auto-collapses below 1100px; hamburger drawer on mobile
- **Mobile responsive** — safe-area insets, touch-action optimisations, iOS font inflation fixes, Android tap-delay removed
- **First-time onboarding** — step-by-step setup guide shown when no leads exist yet

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router, JS) |
| Database | Neon PostgreSQL via `@neondatabase/serverless` |
| Styling | Growleads design system (dark theme, CSS custom properties) |
| Deployment | Vercel + Neon (production) |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```
DATABASE_URL=your_neon_connection_string
```

Get your connection string from [console.neon.tech](https://console.neon.tech).

> **Password:** The dashboard password is `Growleads@admin`. To change it, update the constant in `src/app/api/auth/login/route.js`.

### 3. Create the database schema

Run this in the Neon SQL console:

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

### 4. Run locally

```bash
npm run dev
```

For local webhook testing, open a public tunnel:

```bash
ngrok http 3000
# Webhook endpoint: https://<your-ngrok-url>/api/webhook/happierleads
```

### 5. Connect Happier Leads

1. Go to `admin.happierleads.com` → Automations
2. Open your automation → edit the Webhook action
3. Paste your webhook URL as the endpoint (Vercel URL for production, ngrok for local dev)
4. Set segment to **All Leads** to capture both Exact and Suggested visitors
5. **Activate** the automation

Leads will appear in the dashboard within seconds of a visitor being identified.

## Routes

| Route | Auth | Description |
|---|---|---|
| `/login` | public | Password login page |
| `/` | required | Overview — stat cards, analytics chart, pipeline status |
| `/filtered` | required | Leads — tabs, time filters, expandable rows, Export CSV |
| `/campaigns` | required | Campaigns — SmartLead pipeline view (Phase 2) |
| `POST /api/auth/login` | public | Validate password, set session cookie |
| `POST /api/webhook/happierleads` | public | Inbound webhook from Happier Leads |
| `GET /api/leads` | required | Paginated leads list (`page`, `limit`, `type`, `search`, `since`, `dateFrom`, `dateTo`) |
| `GET /api/leads/[id]` | required | Single lead with full raw\_payload |
| `GET /api/leads/chart` | required | Daily/hourly lead counts for analytics chart |

## Deploying to Vercel

This app is already deployed at [https://happier-leads-automation.vercel.app](https://happier-leads-automation.vercel.app).

To deploy your own instance:

1. Push this repo to GitHub
2. Connect the repo in [vercel.com](https://vercel.com)
3. Add `DATABASE_URL` as an environment variable in Vercel's project settings
4. Deploy — your app gets a permanent URL
5. Update the webhook URL in Happier Leads to your Vercel URL

Or via the Vercel CLI:

```bash
npm i -g vercel
vercel deploy --prod --yes
vercel env add DATABASE_URL production
vercel deploy --prod --yes   # redeploy to pick up the env var
```

## Phase 2 — SmartLead integration

The `pushed_to_smart_lead` / `pushed_at` columns and the disabled "Push to SmartLead" button in the Leads table are placeholders. When ready, add a `PATCH /api/leads/[id]/push` route that calls SmartLead's API and marks the lead as pushed. The Campaigns page will also pull live data from SmartLead's campaign API.

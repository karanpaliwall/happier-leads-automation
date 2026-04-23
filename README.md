# Happier Leads Automation

**Live:** [https://happier-leads-automation.vercel.app](https://happier-leads-automation.vercel.app)

A self-hosted pipeline that captures identified website visitors from [Happier Leads](https://happierleads.com) via webhook, stores them in a PostgreSQL database, and displays them in a real-time dashboard — with full lead detail, fit score breakdown, engagement scoring, and bulk management.

## What it does

When Happier Leads identifies a visitor on your website, it fires a webhook to this app. The app deduplicates the lead, stores it in Neon PostgreSQL, and shows it in the dashboard within seconds.

```
Website visitor → Happier Leads identifies them
    → POST /api/webhook/happierleads
    → Deduplicate + store in Neon PostgreSQL
    → Dashboard auto-refreshes every 10s
```

## Features

- **Password protected** — Login gate on all app routes; 30-day session cookie; webhook stays public
- **Real-time dashboard** — Overview with stat cards, pipeline status, and recent leads feed; polls every 10s
- **Full lead details** — Click any row to expand contact info, company details, fit score breakdown, visit intelligence, and UTM attribution — instant, no extra fetch
- **Fit Score & Engagement** — Fit score summed from Happier Leads' ICP criteria; engagement derived from visit count and time on site (0–20 scale)
- **Waterfall Verified badge** — shown on emails when Happier Leads confirms an exact match
- **Bulk delete** — checkbox multi-select with confirm dialog
- **Layered deduplication** — checks HL ID → email → LinkedIn → name+company before inserting
- **Collapsible sidebar** — collapses to icon-only rail; brand area shows Growleads logo + current section label
- **Instant tab switching** — module-level cache keeps data visible while navigating between pages
- **First-time onboarding** — step-by-step setup guide shown when no leads exist yet
- **Mobile responsive** — hamburger drawer on phones/tablets; tightened padding and wrapping at 480px

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router, JS) |
| Database | Neon PostgreSQL via `@neondatabase/serverless` |
| Styling | Growleads design system (dark theme, CSS custom properties) |
| Deployment | Vercel + Neon (production) / ngrok (local dev) |

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
# Terminal 1 — start the app
npm run dev

# Terminal 2 — open a public tunnel
ngrok http 3000
```

Copy the ngrok URL. Your webhook endpoint is:
```
https://<your-ngrok-url>/api/webhook/happierleads
```

### 5. Connect Happier Leads

1. Go to `admin.happierleads.com` → Automations
2. Open your automation → edit the Webhook action
3. Paste your ngrok URL as the endpoint
4. Set segment to **All Leads** to capture both Exact and Suggested visitors
5. **Activate** the automation

Leads will appear in the dashboard within seconds of a visitor being identified.

## Routes

| Route | Auth | Description |
|---|---|---|
| `/login` | public | Password login page |
| `/` | required | Overview — stat cards, pipeline status, recent 5 leads |
| `/leads` | required | Full leads table with expandable rows, filters, bulk delete |
| `/filtered` | required | Filtered view with type tabs and debounced search |
| `POST /api/auth/login` | public | Validate password, set session cookie |
| `POST /api/webhook/happierleads` | public | Inbound webhook from Happier Leads |
| `GET /api/leads` | required | Paginated leads list (supports `page`, `limit`, `type`, `search`) |
| `DELETE /api/leads` | required | Bulk delete — body: `{ ids: [...uuid] }` |
| `POST /api/admin/backfill-scores` | required | One-time backfill to recalculate scores from stored raw_payload |

## Deploying to Vercel

This app is already deployed at [https://happier-leads-automation.vercel.app](https://happier-leads-automation.vercel.app).

To deploy your own instance:

1. Push this repo to GitHub
2. Connect the repo in [vercel.com](https://vercel.com)
3. Add `DATABASE_URL` as an environment variable in Vercel's project settings
4. Deploy — your app gets a permanent URL (e.g. `https://your-app.vercel.app`)
5. Update the webhook URL in Happier Leads from ngrok → your Vercel URL

Or use the Vercel CLI:

```bash
npm i -g vercel
vercel deploy --prod --yes
vercel env add DATABASE_URL production
vercel deploy --prod --yes   # redeploy to pick up the env var
```

## Phase 2 — Smart Lead integration

The `pushed_to_smart_lead` / `pushed_at` columns and the disabled "Push to Smart Lead" button in the leads table are placeholders. When ready, add a `PATCH /api/leads/[id]/push` route that calls Smart Lead's API and marks the lead as pushed.

# Happier Leads Automation

**Live:** [https://happier-leads-automation.vercel.app](https://happier-leads-automation.vercel.app)

A self-hosted pipeline that captures identified website visitors from [Happier Leads](https://happierleads.com) via webhook, stores them in Neon PostgreSQL, and displays them in a real-time dashboard with lead detail, fit/engagement scoring, SmartLead push, and campaign analytics.

## What it does

When Happier Leads identifies a visitor on your website, it fires a webhook to this app. The app deduplicates the lead, stores it in Neon PostgreSQL, and shows it in the dashboard within seconds.

```
Website visitor → Happier Leads identifies them
    → POST /api/webhook/happierleads
    → Deduplicate + store in Neon PostgreSQL
    → Dashboard auto-refreshes every 10s
```

## Features

- **Password protected** — login gate on all app routes; `gl_session` cookie (30-day); webhook stays public
- **Overview dashboard** — stat cards (total, new today, exact, suggested), pipeline status, analytics chart with period-over-period comparison, 24h / 7d / custom date-range filters
- **Leads page** — full table with tabs, search, time filters, click-to-expand detail panel, Export CSV (30 columns)
- **Push to SmartLead** — push any lead to a SmartLead campaign directly from the dashboard; idempotent (won't double-push)
- **SmartLead Campaigns** — live campaign analytics (leads, completed, in-progress, opens, replies, bounces) pulled from the SmartLead API
- **HeyReach Campaigns** — live LinkedIn campaign analytics (invites sent, accepted, messages sent, replies) pulled from the HeyReach API
- **Fit Score & Engagement** — fit score summed from Happier Leads ICP criteria; engagement derived from visit count and time on site (0–20 scale)
- **Layered deduplication** — HL ID → email → LinkedIn → name+company; retries on Neon cold starts; race-condition safe (23505 handler)
- **Collapsible sidebar** — icon-only rail; auto-collapses below 1100px; hamburger drawer on mobile
- **Mobile responsive** — safe-area insets, iOS font inflation fixes, Android tap-delay removed

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router, JS) |
| Database | Neon PostgreSQL via `@neondatabase/serverless` |
| Styling | Growleads design system (dark theme, CSS custom properties) |
| Deployment | Vercel + Neon (production) |

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `LOGIN_PASSWORD` | No (default: `Growleads@admin`) | Dashboard login password |
| `SESSION_TOKEN` | No (default: `gl-auth-v1`) | Session cookie value |
| `WEBHOOK_SECRET` | No | If set, webhook requires `?secret=<value>` in URL or `x-hl-secret` header |
| `SMARTLEAD_API_KEY` | For SmartLead features | SmartLead API key |
| `HEYREACH_API_KEY` | For HeyReach features | HeyReach API key (`X-API-KEY` header) |

Set all in `.env.local` for local dev, and in Vercel environment settings for production.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.local`

```
DATABASE_URL=your_neon_connection_string
LOGIN_PASSWORD=Growleads@admin
SESSION_TOKEN=gl-auth-v1
SMARTLEAD_API_KEY=your_smartlead_key
HEYREACH_API_KEY=your_heyreach_key
```

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

CREATE TABLE IF NOT EXISTS campaign_ids (
  id TEXT PRIMARY KEY, added_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS heyreach_campaign_ids (
  id TEXT PRIMARY KEY, added_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. Run locally

```bash
npm run dev
```

### 5. Connect Happier Leads

1. Go to `admin.happierleads.com` → Automations
2. Open your automation → edit the Webhook action
3. Set the endpoint to your Vercel URL:
   `https://happier-leads-automation.vercel.app/api/webhook/happierleads`
4. Set segment to **All Leads** to capture both Exact and Suggested visitors
5. **Activate** the automation

Leads appear in the dashboard within seconds of a visitor being identified.

> **Webhook security:** If you set `WEBHOOK_SECRET` in Vercel, you must also add `?secret=<value>` to the webhook URL in Happier Leads at the same time. Setting one without the other will silently break ingestion.

## Routes

| Route | Auth | Description |
|---|---|---|
| `/login` | public | Password login page |
| `/` | required | Overview — stat cards, analytics chart, pipeline status |
| `/filtered` | required | Leads — search, filters, expandable rows, Export CSV |
| `/campaigns` | required | SmartLead campaign analytics |
| `/heyreach/campaigns` | required | HeyReach LinkedIn campaign analytics |
| `POST /api/auth/login` | public | Validate password, set session cookie |
| `POST /api/webhook/happierleads` | public | Inbound webhook from Happier Leads |
| `GET /api/leads` | required | Paginated leads (`page`, `limit`, `type`, `search`, `since`, `dateFrom`, `dateTo`) |
| `GET /api/leads/[id]` | required | Single lead with full `raw_payload` |
| `GET /api/leads/chart` | required | Daily/hourly lead counts for analytics chart |
| `GET /api/leads/export` | required | CSV export matching active filters (up to 10,000 rows) |
| `POST /api/leads/[id]/push` | required | Push lead to SmartLead campaign |
| `GET /api/smartlead/campaigns` | required | SmartLead campaign analytics |
| `GET /api/heyreach/campaigns` | required | HeyReach campaign analytics |

## Deploying to Vercel

This app is already deployed at [https://happier-leads-automation.vercel.app](https://happier-leads-automation.vercel.app).

To deploy your own instance:

1. Push this repo to GitHub
2. Connect the repo in [vercel.com](https://vercel.com)
3. Add all required environment variables in Vercel project settings
4. Deploy — Vercel assigns a permanent URL
5. Set that URL as the webhook endpoint in Happier Leads

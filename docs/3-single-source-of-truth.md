# Single Source of Truth

This document is the canonical reference for the system. Update it whenever the schema, API, or config changes.

---

## Database Schema (Neon)

```sql
CREATE TABLE leads (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at          TIMESTAMPTZ DEFAULT now(),

  happier_leads_id     TEXT        UNIQUE,          -- dedup key from HL payload

  first_name           TEXT,
  last_name            TEXT,
  full_name            TEXT,
  email                TEXT,
  linkedin_url         TEXT,

  company_name         TEXT,
  company_domain       TEXT,
  company_logo_url     TEXT,

  lead_type            TEXT,        -- 'exact' | 'suggested'
  fit_score            NUMERIC,     -- 0 to 30
  engagement_score     NUMERIC,     -- 0 to 20
  activity_at          TIMESTAMPTZ,

  pushed_to_smart_lead BOOLEAN      DEFAULT false,
  pushed_at            TIMESTAMPTZ,

  raw_payload          JSONB        NOT NULL
);

CREATE INDEX leads_received_at_idx ON leads(received_at DESC);
CREATE INDEX leads_company_idx     ON leads(company_name);
CREATE INDEX leads_type_idx        ON leads(lead_type);
CREATE INDEX leads_email_idx       ON leads(email)        WHERE email IS NOT NULL;
CREATE INDEX leads_linkedin_idx    ON leads(linkedin_url) WHERE linkedin_url IS NOT NULL;

-- Campaign IDs tracked on the SmartLead Campaigns page (auto-created on first API request)
CREATE TABLE IF NOT EXISTS campaign_ids (
  id       TEXT        PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT now()
);

-- Campaign IDs tracked on the HeyReach Campaigns page (auto-created on first API request)
CREATE TABLE IF NOT EXISTS heyreach_campaign_ids (
  id       TEXT        PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT now()
);
```

**Status:** `leads` schema is live in Neon production (created 2026-04-22). `campaign_ids` is auto-created on first request to `GET /api/campaigns/ids`.

---

## Authentication

All data API routes (`/api/leads`, `/api/leads/[id]`, `/api/leads/chart`, `/api/leads/export`) require auth. The `src/lib/auth.js` `requireAuth()` helper accepts either:

- **Cookie:** `gl_session=<token>` (set by the browser on login)
- **Bearer token:** `Authorization: Bearer <token>` (for programmatic/agent access)

Token value: `process.env.SESSION_TOKEN` (falls back to `'gl-auth-v1'`)

- Cookie name: `gl_session`
- Cookie set by: `POST /api/auth/login` on successful password entry — `maxAge: 30 days`

The Next.js middleware (`src/middleware.js`) also protects all page routes by redirecting to `/login` if the cookie is absent.

---

## API Contracts

### POST /api/webhook/happierleads
Receives webhook from Happier Leads automation. No session auth required (public endpoint).

**Optional secret validation:** If `WEBHOOK_SECRET` env var is set, the request must include the secret via one of:
- `?secret=<secret>` URL query param (recommended — works with Happier Leads webhook URL config), or
- `x-hl-secret: <secret>` header, or
- `Authorization: <secret>` header

If `WEBHOOK_SECRET` is not set, all requests are accepted (logs a warning). This means missing the env var never silently breaks webhook ingestion.

**Request:** JSON body (Happier Leads payload — see Webhook Payload section below)

**Response:**
```json
{ "ok": true }
// or for duplicates:
{ "ok": true, "duplicate": true }
```

---

### POST /api/auth/login
Password gate. Sets the session cookie on success.

**Rate limit:** 10 requests/min per IP (in-memory, resets on cold start).

**Request:**
```json
{ "password": "..." }
```

**Response:**
```json
{ "ok": true }
```
Sets `gl_session` cookie (httpOnly, sameSite: strict, secure in production, maxAge: 30 days).

---

### GET /api/leads
Returns paginated leads for the dashboard. **Auth required.**

`raw_payload` is **not** included in this response — it is only available via `GET /api/leads/[id]`.

**Query params:**
- `page` — integer, default 1
- `limit` — integer, default 25, max 100
- `type` — `"exact"` | `"suggested"` | omit for all
- `search` — text, searches `company_name`, `full_name`, `email`
- `since` — ISO timestamp; filters `received_at >= since` (used by 24h / 7d quick filters)
- `dateFrom` — ISO date string `YYYY-MM-DD`; filters `received_at >= dateFrom` (inclusive, index-friendly)
- `dateTo` — ISO date string `YYYY-MM-DD`; filters `received_at < dateTo + 1 day` (inclusive upper bound)

**Response:**
```json
{
  "leads": [
    {
      "id": "uuid",
      "received_at": "2026-04-22T10:30:00Z",
      "first_name": "John",
      "last_name": "Doe",
      "full_name": "John Doe",
      "email": "john@example.com",
      "linkedin_url": "https://linkedin.com/in/johndoe",
      "company_name": "Acme Corp",
      "company_domain": "acme.com",
      "company_logo_url": null,
      "lead_type": "exact",
      "fit_score": 24,
      "engagement_score": 15,
      "activity_at": "2026-04-21T22:02:42Z",
      "pushed_to_smart_lead": false,
      "pushed_at": null
    }
  ],
  "total": 42,
  "stats": {
    "total": 205,
    "newToday": 12,
    "newTodayExact": 8,
    "newTodaySuggested": 4,
    "exact": 87,
    "suggested": 118
  }
}
```

---

### GET /api/leads/[id]
Returns a single lead including `raw_payload`. **Auth required.** Used by the detail panel on first expand; subsequent expands use the client-side cache.

### DELETE /api/leads/[id]
Permanently deletes a lead. **Auth required.** Returns `{ "ok": true }` or `404` if not found. Used to remove test entries.

**Response:** Full lead row including `raw_payload` JSONB.

---

### GET /api/leads/export
Returns a CSV file with all matching leads and full `raw_payload` fields expanded. **Auth required.**

Accepts the same filter query params as `GET /api/leads` (`type`, `search`, `since`, `dateFrom`, `dateTo`). No pagination — returns up to **10,000 rows** (safety cap to prevent OOM).

**Response:** `text/csv` with `Content-Disposition: attachment; filename="leads-YYYY-MM-DD.csv"`.

Columns: Name, Email, LinkedIn, Company, Domain, Type, Fit Score, Engagement Score, Received, Personal Email, Position, Phone, Location, Contact Type, Sector, Industry, Company Country, Employees Range, Est. Revenue, Year Founded, Total Visits, Total Duration, First Visit, Referrer, IP Address, Pages Visited, UTM Source, UTM Medium, UTM Campaign, UTM Term.

---

### GET /api/leads/chart
Returns lead counts grouped by day or hour for the Overview page chart. **Auth required.**

**Query params:**
- `since` — ISO timestamp; enables hourly mode (`received_at >= since`)
- `dateFrom` — ISO date `YYYY-MM-DD`; inclusive lower bound — `received_at >= dateFrom` (daily mode)
- `dateTo` — ISO date `YYYY-MM-DD`; inclusive upper bound — `received_at < dateTo + 1 day` (daily mode)

**Response:**
```json
{
  "granularity": "day",
  "points": [
    { "date": "2026-04-22", "total": 45, "exact": 30, "suggested": 15 },
    { "date": "2026-04-23", "total": 21, "exact": 14, "suggested": 7 }
  ]
}
```
When `since` is provided, `granularity` is `"hour"` and `date` is a full ISO timestamp. Only dates/hours with at least one lead are returned; the frontend fills gaps with zeros.

---

### GET /api/smartlead/campaigns
Returns normalized campaign data for a list of SmartLead campaign IDs. **Auth required.**

**Query params:**
- `ids` — comma-separated SmartLead campaign IDs (max 20), e.g. `?ids=123,456,789`

Fetches `GET /campaigns/{id}` and `GET /campaigns/{id}/analytics` in parallel per ID using `Promise.allSettled` (single failure doesn't block others).

**Response:**
```json
{
  "campaigns": [
    {
      "id": "123",
      "name": "My Campaign",
      "status": "ACTIVE",
      "created": "2024-01-01T00:00:00.000Z",
      "totalLeads": 500,
      "completed": 200,
      "inProgress": 250,
      "yetToStart": 50,
      "blocked": 5,
      "sendPending": 10,
      "opens": 100,
      "replies": 30,
      "bounces": 5,
      "clicks": 20
    }
  ],
  "fetchedAt": "2026-04-27T10:00:00.000Z"
}
```

---

### GET /api/heyreach/campaigns
Returns normalized LinkedIn campaign data for a list of HeyReach campaign IDs. **Auth required.**

**Query params:**
- `ids` — comma-separated HeyReach campaign IDs (max 20), e.g. `?ids=123,456`

Calls `GET /Campaign/GetById?campaignId={id}` and `GET /Campaign/GetCampaignStatsByCampaignId?campaignId={id}` in parallel per ID.
Auth: `X-API-KEY: {HEYREACH_API_KEY}` header on all HeyReach requests.

**Response:**
```json
{
  "campaigns": [
    {
      "id": "123",
      "name": "My LinkedIn Campaign",
      "status": "ACTIVE",
      "list": "Target List Name",
      "created": "2024-01-01T00:00:00.000Z",
      "total": 300,
      "inProgress": 50,
      "pending": 100,
      "finished": 120,
      "failed": 10,
      "stopped": 5,
      "excluded": 15
    }
  ],
  "fetchedAt": "2026-04-28T10:00:00.000Z"
}
```

Note: HeyReach status `IN_PROGRESS` is normalized to `ACTIVE` for display consistency. `list` is the LinkedIn user list name. `acceptRate` and `replyRate` are computed on the frontend from the raw counts.

---

### GET/POST/DELETE /api/heyreach/campaign-ids
Stores HeyReach campaign IDs in the `heyreach_campaign_ids` table. Same contract as `/api/campaigns/ids` but for HeyReach.

---

### POST /api/leads/[id]/push
Pushes a single lead to a HeyReach campaign and marks it as pushed in the DB. **Auth required.**

**Request:**
```json
{ "campaignId": "12345" }
```

**What it does:**
1. Fetches lead from DB (name, email, company, LinkedIn URL)
2. Calls `POST https://api.heyreach.io/api/public/campaign/AddLeadsToCampaignV2` with `X-API-KEY` + `Accept: text/plain` headers
3. Updates the lead row: `pushed_to_smart_lead = true`, `pushed_at = now()` (column name is legacy — functionally means "pushed to HeyReach")

**HeyReach request body:**
```json
{
  "campaignId": 235,
  "accountLeadPairs": [{
    "lead": {
      "firstName": "...",
      "lastName": "...",
      "companyName": "...",
      "position": "...",
      "emailAddress": "...",
      "profileUrl": "https://linkedin.com/in/...",
      "location": "City, State, Country",
      "summary": "LinkedIn headline"
    }
  }],
  "resumeFinishedCampaign": false,
  "resumePausedCampaign": true
}
```

`position`, `location`, and `summary` (LinkedIn headline) are extracted from `raw_payload.contact`. `location` is assembled from `geo.city`, `geo.state`, `geo.country`.

**Response:**
```json
{ "ok": true }
```

**Error responses:** `400` (missing campaignId or invalid ID), `404` (lead not found), `500` (API key missing), `502` (HeyReach rejected the request or network/timeout failure).

Note: There is no `409` — the same lead can be pushed multiple times (for re-engagement campaigns). The UI shows "Re-push" instead of "Push to HeyReach" for already-pushed leads.

---

## Campaign ID Persistence

Campaign IDs are stored in the **database** (`campaign_ids` / `heyreach_campaign_ids` tables) via `/api/campaigns/ids` and `/api/heyreach/campaign-ids`. Max 20 IDs per integration.

The frontend also caches them in `localStorage` (`sl-campaign-ids` / `hr-campaign-ids`) for immediate render on page revisit — but the **DB is authoritative**. On load: show cache instantly → sync with server → reconcile differences. Network failures fall back to the cache.

The HeyReach campaign list (`heyreach_campaign_ids`) powers the "Push to HeyReach" campaign picker on the Leads page.

---

## Environment Variables

| Variable             | Required?               | Purpose                                                                  |
|----------------------|-------------------------|--------------------------------------------------------------------------|
| `DATABASE_URL`       | **Required**            | Neon PostgreSQL connection string (`src/lib/db.js`). Missing = every request 500s at module load. |
| `LOGIN_PASSWORD`     | **Required**            | Password for the `/login` page gate. Missing = login returns 500.        |
| `SESSION_TOKEN`      | **Required**            | Value stored in and checked against the `gl_session` cookie. Missing = login returns 500, all auth fails. |
| `WEBHOOK_SECRET`     | Optional                | If set, webhook requires matching `?secret=` URL param or `x-hl-secret` header. If unset, all requests accepted (logs warning). |
| `SMARTLEAD_API_KEY`  | Required for SmartLead  | SmartLead API key — used by `/api/smartlead/campaigns` (SmartLead Campaigns page). Not used by the push route (now HeyReach). |
| `HEYREACH_API_KEY`   | Required for HeyReach   | HeyReach API key — passed as `X-API-KEY` header. Missing = 500 on `/api/heyreach/campaigns`. |
| `HEYREACH_CAMPAIGN_ID` | Required for auto-push | Campaign ID for the Universe campaign (`413857`). If absent, auto-push on new lead arrival is silently skipped. |

Set all in `.env.local` for local dev, and in Vercel environment settings for production. `DATABASE_URL`, `LOGIN_PASSWORD`, and `SESSION_TOKEN` must always be set — the app will not function without them.

---

## Webhook Payload (Confirmed 2026-04-22)

Happier Leads sends a POST with this structure:

```json
{
  "leadId": "...",
  "contact": {
    "firstName": "...",
    "lastName": "...",
    "businessEmail": "...",
    "personalEmail": "...",
    "linkedin": "https://linkedin.com/in/...",
    "contactType": "Exact Visitor",
    "position": "...",
    "headline": "...",
    "phone": "...",
    "geo": { "city": "...", "state": "...", "country": "..." },
    "listContacts": [...],
    "additionalContacts": [...]
  },
  "company": {
    "name": "...",
    "domain": "...",
    "sector": "...",
    "industry": "...",
    "country": "...",
    "employeesRange": "...",
    "estimatedAnnualRevenue": "...",
    "linkedinPage": "...",
    "yearFounded": 1234
  },
  "scores": [
    { "score": 5, "category": "Company Size", "fitScoreRatio": 85, "reason": "..." },
    { "score": 4, "category": "Industry Match", "fitScoreRatio": 85, "reason": "..." }
  ],
  "summary": {
    "visits": 7,
    "duration": 60000,
    "lastSession": { "date": "2026-04-21T22:02:42.187Z", "city": "...", "country": "US" }
  },
  "pageVisits": [{ "path": "/", "totalTime": 2034, "visitCount": 3 }],
  "utm": { "source": "google", "medium": "cpc", "campaign": "...", "term": "..." },
  "ip": "...",
  "clientId": "...",
  "referrer": "...",
  "isFirstVisit": true,
  "customData": {}
}
```

**Field mapping in webhook route:**
- `leadId` → `happier_leads_id`
- `contact.firstName/lastName` → `first_name`, `last_name`, `full_name`
- `contact.businessEmail` → `email`
- `contact.linkedin` → `linkedin_url`
- `contact.contactType` ("Exact Visitor" → `"exact"`, else `"suggested"`) → `lead_type`
- `company.name/domain/logo` → `company_name`, `company_domain`, `company_logo_url`
- `scores[].score` (or `scores[].fitScore`) summed → `fit_score`
- `summary.lastSession.date` → `activity_at`
- `engagement_score` — **not present in payload**, derived from visits + duration (see below)

---

## Happier Leads Automation Config

- **Automation:** "automation" card — **Active** (permanent Vercel URL, no ngrok needed)
- **Trigger:** A new lead is identified — Only on first visit
- **Filter:** All Leads (catches both Exact and Suggested)
- **Action:** Webhook → POST to `https://websitevisitors.growleads.io/api/webhook/happierleads` (custom domain; Vercel alias `happier-leads-automation.vercel.app` also works)
- **Confirmed working:** test webhook + real webhooks both received successfully

## Engagement Score Calculation

`engagement_score` is **not** in the Happier Leads payload — it is calculated by the webhook handler:

```
engagement_score = min(10, visits × 2) + min(10, floor(durationMs / 60000))
```

Max 20 pts. `visits` from `summary.visits`, `durationMs` from `summary.duration`.

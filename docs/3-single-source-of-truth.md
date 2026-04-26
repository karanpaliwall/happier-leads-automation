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
```

**Status:** Schema is live in Neon production (created 2026-04-22). This SQL is for reference only.

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

**Optional secret validation:** If `WEBHOOK_SECRET` env var is set, the request must include either:
- `x-hl-secret: <secret>` header, or
- `Authorization: <secret>` header

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
Sets `gl_session` cookie (httpOnly, sameSite: lax, secure in production, maxAge: 30 days).

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

## Environment Variables

| Variable          | Default / fallback      | Purpose                                                         |
|-------------------|-------------------------|-----------------------------------------------------------------|
| `DATABASE_URL`    | *(required)*            | Neon PostgreSQL connection string (`src/lib/db.js`)             |
| `LOGIN_PASSWORD`  | `'Growleads@admin'`     | Password for the `/login` page gate                             |
| `SESSION_TOKEN`   | `'gl-auth-v1'`          | Value stored in and checked against the `gl_session` cookie     |
| `WEBHOOK_SECRET`  | *(optional)*            | If set, webhook requires matching `x-hl-secret` header         |

Set all in `.env.local` for local dev, and in Vercel environment settings for production. The fallback values keep the app working with zero config; set the env vars in production to harden.

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
- **Action:** Webhook → POST to `https://happier-leads-automation.vercel.app/api/webhook/happierleads`
- **Confirmed working:** test webhook + real webhooks both received successfully

## Engagement Score Calculation

`engagement_score` is **not** in the Happier Leads payload — it is calculated by the webhook handler:

```
engagement_score = min(10, visits × 2) + min(10, floor(durationMs / 60000))
```

Max 20 pts. `visits` from `summary.visits`, `durationMs` from `summary.duration`.

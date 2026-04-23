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

## API Contracts

### POST /api/webhook/happierleads
Receives webhook from Happier Leads automation.

**Request:** JSON body (Happier Leads payload — structure TBD after first real webhook)

**Response:**
```json
{ "ok": true }
// or for duplicates:
{ "ok": true, "duplicate": true }
```

### GET /api/leads
Returns paginated leads for the dashboard.

**Query params:**
- `page` — integer, default 1
- `limit` — integer, default 25, max 100
- `type` — `"exact"` | `"suggested"` | omit for all
- `search` — text, searches company_name and full_name
- `since` — ISO timestamp; filters `received_at >= since` (used by 24h / 7d quick filters)
- `dateFrom` — ISO date string `YYYY-MM-DD`; filters `received_at::date >= dateFrom`
- `dateTo` — ISO date string `YYYY-MM-DD`; filters `received_at::date <= dateTo`

**Response:**
```json
{
  "leads": [
    {
      "id": "uuid",
      "received_at": "2026-04-22T10:30:00Z",
      "full_name": "John Doe",
      "email": "john@example.com",
      "company_name": "Acme Corp",
      "company_domain": "acme.com",
      "company_logo_url": null,
      "lead_type": "exact",
      "fit_score": 24,
      "engagement_score": 15,
      "pushed_to_smart_lead": false,
      "raw_payload": { "...": "full Happier Leads payload, used by detail panel" }
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

### GET /api/leads/chart
Returns daily lead counts for the line chart on the Overview page.

**Query params:**
- `dateFrom` — ISO date `YYYY-MM-DD`; inclusive lower bound
- `dateTo` — ISO date `YYYY-MM-DD`; inclusive upper bound (omit for today)

**Response:**
```json
{
  "points": [
    { "date": "2026-04-22", "total": 45, "exact": 30, "suggested": 15 },
    { "date": "2026-04-23", "total": 21, "exact": 14, "suggested": 7 }
  ]
}
```
Note: only dates with at least one lead are returned. The frontend fills gaps with zeros.

---

## Environment Variables

| Variable          | Where to get it                        | Used in                              |
|-------------------|----------------------------------------|--------------------------------------|
| `DATABASE_URL`    | Neon console → Connection Details      | `src/lib/db.js`                      |
| `AUTH_PASSWORD`   | Set to `Growleads@admin`               | `src/app/api/auth/login/route.js`    |

Set both in `.env.local` for local dev, and in Vercel environment settings for production.

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
- `company.name/domain` → `company_name`, `company_domain`
- `scores[].score` summed → `fit_score`
- `summary.lastSession.date` → `activity_at`
- `engagement_score` — **not present in payload**, stored as null

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

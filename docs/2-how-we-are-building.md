# How We Are Building It

## Tech Stack

| Layer       | Tool                          | Reason                                                              |
|-------------|-------------------------------|---------------------------------------------------------------------|
| Framework   | Next.js 16 (App Router)       | Backend API routes + frontend in one codebase, one Vercel deploy    |
| Database    | Neon PostgreSQL               | Serverless Postgres, free tier, works perfectly with Next.js/Vercel |
| DB client   | @neondatabase/serverless      | Official Neon client for serverless/edge environments               |
| Styling     | CSS tokens (growleads design) | Brand design system — dark theme, Inter, `reference.css` + `custom.css` |
| Deployment  | Vercel                        | Zero-config Next.js deploy, custom domain `websitevisitors.growleads.io` |

ngrok is **not needed** — the app is permanently deployed to Vercel with a custom domain.

## Data Flow

```
Website visitor arrives
      ↓
Happier Leads identifies them
      ↓
Happier Leads Automation fires:
  POST https://websitevisitors.growleads.io/api/webhook/happierleads
  Body: JSON with visitor data
      ↓
Webhook route (src/app/api/webhook/happierleads/route.js):
  1. Optional secret check (?secret= URL param)
  2. Parse JSON body (max 64 KB)
  3. Extract fields: name, email, LinkedIn, company, scores, engagement, activity_at
  4. Run layered duplicate check (HL ID → email → LinkedIn → name+company)
  5. If duplicate: return 200 { ok: true, duplicate: true }
  6. If new: INSERT into leads table, return 200 { ok: true }
      ↓
Neon PostgreSQL (leads table)
      ↓
Frontend Dashboard (src/app/page.jsx + src/app/leads/page.jsx):
  - Polls GET /api/leads every 10 seconds (skips when tab is hidden)
  - Overview shows stat cards, analytics chart, pipeline status
  - Leads page shows full table with filters, detail expand, CSV export, HeyReach push
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── webhook/happierleads/route.js     ← webhook receiver
│   │   ├── leads/
│   │   │   ├── route.js                      ← GET (paginated list + stats)
│   │   │   ├── chart/route.js                ← GET (chart points, day/hour)
│   │   │   ├── export/route.js               ← GET (CSV download)
│   │   │   └── [id]/
│   │   │       ├── route.js                  ← GET (full lead), DELETE
│   │   │       └── push/route.js             ← POST (push to HeyReach)
│   │   ├── auth/login/route.js               ← POST (password gate, sets cookie)
│   │   ├── smartlead/campaigns/route.js       ← GET (SmartLead campaign analytics)
│   │   ├── campaigns/ids/route.js             ← GET/POST/DELETE (persisted campaign IDs)
│   │   ├── heyreach/campaigns/route.js        ← GET (HeyReach campaign analytics)
│   │   └── heyreach/campaign-ids/route.js     ← GET/POST/DELETE (persisted campaign IDs)
│   ├── page.jsx                              ← Overview (stat cards, chart)
│   ├── leads/page.jsx                        ← Leads table (filters, expand, push)
│   ├── campaigns/page.jsx                    ← SmartLead campaigns analytics
│   ├── heyreach/campaigns/page.jsx           ← HeyReach campaigns analytics
│   ├── login/page.jsx                        ← Password gate
│   ├── layout.jsx                            ← Server layout (imports CSS, renders ClientLayout)
│   └── globals.css                           ← Minimal global CSS (overflow, text-size-adjust)
├── components/
│   ├── ClientLayout.jsx                      ← Client wrapper (sidebar state, scroll-to-top)
│   ├── Sidebar.jsx                           ← Collapsible nav (desktop + mobile drawer)
│   ├── CalendarPicker.jsx                    ← Reusable date range picker
│   ├── EmptyState.jsx                        ← First-time onboarding panel
│   └── NumCell.jsx                           ← Numeric table cell with formatting
├── hooks/
│   └── usePinnedColumns.js                   ← Column visibility hook for campaign tables
├── styles/
│   ├── reference.css                         ← Full design system (tokens, components)
│   └── custom.css                            ← App-specific overrides + responsive rules
└── lib/
    ├── db.js                                 ← Neon SQL client + withRetry helper
    └── auth.js                               ← requireAuth() (cookie + bearer token)
```

## Duplicate Detection (Layered)

1. `happier_leads_id` — unique ID from Happier Leads payload (most reliable)
2. `email` — if no HL ID, check if email already exists
3. `linkedin_url` — if no email, check LinkedIn URL
4. `full_name + company_name` — last resort fallback

Always returns `200 { ok: true, duplicate: true }` so Happier Leads never retries.

## Campaign ID Persistence

Both SmartLead and HeyReach campaign IDs are stored in the DB (`campaign_ids` / `heyreach_campaign_ids` tables, auto-created on first request). The frontend also caches them in `localStorage` (`sl-campaign-ids` / `hr-campaign-ids`) for immediate render on revisit — but the DB is authoritative. On load, the page shows the cached list instantly, then syncs with the server and reconciles any differences.

## Webhook Payload (Confirmed 2026-04-22)

The Happier Leads payload structure is confirmed. See `docs/3-single-source-of-truth.md` for the full JSON shape and field mapping.

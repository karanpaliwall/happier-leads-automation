# How We Are Building It

## Tech Stack

| Layer       | Tool                          | Reason                                                              |
|-------------|-------------------------------|---------------------------------------------------------------------|
| Framework   | Next.js 14 (App Router)       | Backend API routes + frontend in one codebase, one Vercel deploy    |
| Database    | Neon PostgreSQL               | Serverless Postgres, free tier, works perfectly with Next.js/Vercel |
| DB client   | @neondatabase/serverless      | Official Neon client for serverless/edge environments               |
| Styling     | CSS tokens (growleads design) | Brand design system from signal-tracker repo — dark theme, Inter    |
| Local tunnel| ngrok                         | Exposes localhost:3000 to internet so Happier Leads can call it     |
| Deployment  | Vercel (later)                | Zero-config Next.js deploy, free hobby tier                         |

## Data Flow

```
Website visitor arrives
      ↓
Happier Leads identifies them
      ↓
Happier Leads Automation fires:
  POST https://<your-ngrok-url>/api/webhook/happierleads
  Body: JSON with visitor data
      ↓
Webhook route (src/app/api/webhook/happierleads/route.js):
  1. Parse JSON body
  2. Extract known fields (name, company, scores, etc.)
  3. Run duplicate check (HL ID → email → LinkedIn → name+company)
  4. If duplicate: return 200 { ok: true, duplicate: true }
  5. If new: INSERT into leads table, return 200 { ok: true }
      ↓
Neon PostgreSQL (leads table)
      ↓
Frontend Dashboard (src/app/page.jsx):
  - Fetches GET /api/leads every 30 seconds
  - Renders StatsBar + LeadsTable
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── webhook/happierleads/route.js  ← webhook receiver
│   │   └── leads/route.js                 ← GET API for frontend
│   ├── page.jsx                           ← dashboard page (client)
│   ├── layout.jsx                         ← sidebar shell (server)
│   └── globals.css
├── components/
│   ├── Sidebar.jsx                        ← left nav (client)
│   ├── StatsBar.jsx                       ← stat cards (server)
│   └── LeadsTable.jsx                     ← data table (client)
├── styles/
│   ├── reference.css                      ← full design system
│   └── custom.css                         ← app-specific styles
└── lib/
    └── db.js                              ← Neon SQL client
```

## Duplicate Detection (Layered)

1. `happier_leads_id` — unique ID from Happier Leads payload (most reliable)
2. `email` — if no HL ID, check if email already exists
3. `linkedin_url` — if no email, check LinkedIn URL
4. `full_name + company_name` — last resort fallback

Returns `200 { ok: true, duplicate: true }` so Happier Leads never retries.

## Important Notes

- **Webhook payload is unknown** — Happier Leads docs are behind auth. We store `raw_payload` as JSONB to capture everything. After the first real webhook, read `raw_payload` in Neon and update field extraction keys in `src/app/api/webhook/happierleads/route.js`.
- **ngrok URL changes on restart** — each time you run `ngrok http 3000` you get a new URL. Update it in Happier Leads automation each time (or use ngrok's paid persistent subdomain).

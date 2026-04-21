# Context — Running Changelog

This file is updated after every change, fix, or feature addition.
Read this first when resuming work to get back up to speed.

---

## 2026-04-22 — Project initialized

- What changed: Full project scaffolded from scratch
- Why: Building lead capture pipeline — Happier Leads webhook → Neon DB → custom dashboard → Smart Lead (Phase 2)
- Files created:
  - `package.json` — Next.js 14, React 18, @neondatabase/serverless
  - `next.config.js`, `jsconfig.json`, `.gitignore`, `.env.local`
  - `src/styles/reference.css` — full Growleads design system (dark theme, Inter font)
  - `src/styles/custom.css` — app-specific styles (badge-exact, badge-suggested, score bars, etc.)
  - `src/app/layout.jsx` — sidebar shell
  - `src/app/page.jsx` — dashboard with filter, stats, leads table, 30s auto-refresh
  - `src/app/globals.css`
  - `src/lib/db.js` — Neon SQL client
  - `src/app/api/webhook/happierleads/route.js` — webhook receiver with layered dedup
  - `src/app/api/leads/route.js` — paginated leads API with filter/search
  - `src/components/Sidebar.jsx`, `StatsBar.jsx`, `LeadsTable.jsx`
  - `docs/1-what-we-are-building.md`, `docs/2-how-we-are-building.md`, `docs/3-single-source-of-truth.md`

## 2026-04-22 — Webhook payload confirmed + extraction keys updated

- What changed: First test webhook received. Real payload structure confirmed. Updated `src/app/api/webhook/happierleads/route.js` with correct field keys. Updated `docs/3-single-source-of-truth.md` with full payload schema.
- Key findings: `leadId` (not `id`), person data under `contact` (not `person`), `contact.businessEmail`, `contact.contactType` for lead type, `scores[]` array summed for fit_score, `engagement_score` not in payload
- Files affected: `src/app/api/webhook/happierleads/route.js`, `docs/3-single-source-of-truth.md`

## 2026-04-22 — Neon DB schema created

- What changed: `leads` table + 3 indexes created in Neon production branch
- Why: Database ready to receive webhook data
- Files affected: none (DB only)

## 2026-04-22 — Dependencies installed + CLAUDE.md created

- What changed: `npm install` completed. Upgraded Next.js to 16.2.4 (security patches) and React to 19.2.5. `npm run build` passes clean. `CLAUDE.md` created with project conventions.
- Why: Security vulnerabilities in Next.js 14 required upgrade; CLAUDE.md for session continuity
- Files affected: `package.json`, `CLAUDE.md`

## 2026-04-22 — Backfill endpoint + scores fixed on all existing leads

- What changed: Created `POST /api/admin/backfill-scores` — reads raw_payload for every lead and writes correct fit_score and engagement_score. Run it once after deploy to fix existing data.
- Why: Existing leads had fit_score=0 (wrong field name) and engagement_score=null (never set)
- Ran successfully: `{"ok":true,"updated":1}` — all existing leads patched
- Files affected: `src/app/api/admin/backfill-scores/route.js` (created)

## 2026-04-22 — Fit score extraction fix + engagement score calculation

- What changed: Webhook route now tries multiple field name fallbacks for fit score (`s.score ?? s.value ?? s.points`). Engagement score is now calculated from visit data (0–20 scale) rather than left null.
- Why: `s.score` was undefined in real payloads (field name uncertainty); engagement score was never in the HL payload so it was always null
- Engagement formula: `min(10, visits×2) + min(10, floor(durationMs/60000))` — max 20 pts
- Files affected: `src/app/api/webhook/happierleads/route.js`
- **Backfill SQL** — run in Neon console to fix existing leads:
  ```sql
  -- Fix fit_score by re-reading raw_payload (tries 'score', 'value', 'points' field names)
  UPDATE leads
  SET fit_score = (
    SELECT COALESCE(SUM(COALESCE(
      NULLIF((s->>'score')::numeric, 0),
      (s->>'value')::numeric,
      (s->>'points')::numeric,
      0
    )), 0)
    FROM jsonb_array_elements(raw_payload->'scores') s
  )
  WHERE jsonb_array_length(raw_payload->'scores') > 0;

  -- Set engagement_score from visit activity for existing leads
  UPDATE leads
  SET engagement_score = LEAST(10, COALESCE((raw_payload->'summary'->>'visits')::int, 0) * 2)
                       + LEAST(10, FLOOR(COALESCE((raw_payload->'summary'->>'duration')::numeric, 0) / 60000))
  WHERE raw_payload->'summary' IS NOT NULL;
  ```
  **Note:** If fit_score stays 0 after the backfill, the company genuinely scores 0 against your configured ICP in Happier Leads. Check your ICP settings at admin.happierleads.com.

## 2026-04-22 — Three-tab UI overhaul + full lead detail expansion

- What changed: Complete UI redesign — three separate routes, Growleads logo, expandable rows showing ALL Happier Leads data, mobile responsive sidebar
- Why: User wants every field from Happier Leads visible on the frontend; better navigation structure
- Files created/updated:
  - `public/growleads-logo.png` — downloaded from karanpaliwall/signal-tracker GitHub repo
  - `src/components/ClientLayout.jsx` — new: manages mobile sidebar open/close state
  - `src/app/layout.jsx` — updated to use ClientLayout (enables mobile hamburger menu)
  - `src/components/Sidebar.jsx` — updated: growleads-logo.png, Overview/Leads/Filtered nav items, mobile close button
  - `src/app/page.jsx` — rewritten as Overview: stat cards v2 (with icons + colored top borders), pipeline status card, recent 5 leads feed
  - `src/app/leads/page.jsx` — new route: full table with expandable rows. Click any row to reveal Contact Details, Company Details, Fit Score Breakdown, Visit Intelligence, Attribution (UTM) — all from raw_payload
  - `src/app/filtered/page.jsx` — new route: tabs-pill (All/Exact/Suggested), debounced search, clear filters button, skeleton loading
  - `src/app/api/leads/route.js` — updated: raw_payload now included in SELECT so detail panels work
  - `src/styles/custom.css` — major update: stat-card-v2, overview-grid, tabs-pill, detail-panel, score-breakdown, page-visits, skeleton, hamburger, mobile responsive

## 2026-04-22 — Removed Next.js devtools "N" button

- What changed: Added `devIndicators: false` to `next.config.js`
- Why: Next.js dev overlay button was rendering over the sidebar footer Connected indicator
- Files affected: `next.config.js`

## 2026-04-22 — Checkbox multi-select + bulk delete on Leads page

- What changed: Added checkbox column to Leads table. Select-all in header. When 1+ rows selected, a red "Delete X selected" button appears in the filter bar. Confirms via `window.confirm()` before deleting. After delete, table auto-refreshes.
- Why: User needs ability to remove leads from the dashboard
- API: Added `DELETE /api/leads` handler — accepts `{ ids: [...uuid] }`, deletes all matching rows
- Files affected: `src/app/api/leads/route.js` (DELETE method added), `src/app/leads/page.jsx` (checkbox column, selection state, handleDelete), `src/styles/custom.css` (checkbox-cell, row-checkbox, lead-row-selected, delete-selected-btn)

## 2026-04-22 — Fit Score + Engagement tooltips on column headers

- What changed: Added ⓘ info icon next to "Fit Score" and "Engagement" column headers. Hovering shows a full description tooltip explaining what each score means.
- Why: New users need context on what the scores represent
- Implementation: `ColHeader` component in `src/app/leads/page.jsx`. Uses `getBoundingClientRect()` + `position: fixed` so the tooltip escapes the card's `overflow: hidden` and is never clipped. Arrow points down toward the header.
- Fit Score tip: "How well this company matches your ICP — scored by Happier Leads based on industry, size, revenue, and criteria you've configured. Max 30 pts."
- Engagement tip: "How actively this visitor engaged with your site. Calculated from visits (up to 10 pts) and time spent (up to 10 pts). Max 20 pts."
- Files affected: `src/app/leads/page.jsx`, `src/styles/custom.css` (col-header-tip, col-tip-icon, col-tip-fixed)

## 2026-04-22 — First-time empty state (onboarding guide)

- What changed: Added `EmptyState` component and integrated it into both Overview and Leads pages. When no leads exist yet, users see a 4-step onboarding guide instead of a blank page.
- Why: New users have no context on how to connect Happier Leads — the empty state walks them through starting ngrok, pasting the webhook URL, activating the automation, and waiting for the first visitor.
- EmptyState shows: start ngrok, paste URL into HL, activate automation, wait for first visitor. Footer shows "Webhook endpoint is live" with green dot.
- Overview: shows EmptyState when `stats.total === 0 && !loading`; stat cards + pipeline grid only render when total > 0 (or while loading)
- Leads: shows EmptyState when `stats.total === 0 && !typeFilter && !search`; shows "No leads match your filters" when filters active but no results
- Files affected: `src/components/EmptyState.jsx` (created), `src/app/page.jsx` (EmptyState import + conditional rendering), `src/app/leads/page.jsx` (EmptyState import + conditional), `src/styles/custom.css` (empty-onboarding styles)

## Current Status

- [x] `npm install` — done (Next.js 16.2.4, React 19.2.5)
- [x] Build passes clean — `npm run build` succeeds
- [x] CLAUDE.md created
- [x] Neon DB schema — created (leads table + 3 indexes, production branch)
- [x] ngrok — installed and working (URL changes on each restart)
- [x] Happier Leads automation — created and activated, webhook confirmed working
- [x] First webhook received and payload confirmed — field extraction updated in webhook/route.js
- [x] Three-tab UI — Overview / Leads / Filtered routes
- [x] Growleads logo in sidebar
- [x] Expandable lead rows — all Happier Leads data visible (contact, company, scores, visits, UTM)
- [x] Mobile responsive — hamburger menu + sidebar overlay
- [x] Checkbox multi-select + bulk delete on Leads page
- [x] DELETE /api/leads endpoint
- [x] Fit Score + Engagement tooltips (position:fixed, never clipped)
- [x] Engagement score calculated from visit data (not null anymore)
- [x] Fit score extraction tries score/value/points fallbacks
- [x] Backfill endpoint — POST /api/admin/backfill-scores (run once after deploy)
- [x] Next.js devtools button hidden (devIndicators: false)
- [x] First-time empty state — onboarding guide on Overview + Leads pages when no leads exist

## Architecture — current file map

```
src/
├── app/
│   ├── api/
│   │   ├── admin/backfill-scores/route.js  ← one-time backfill for existing leads
│   │   ├── leads/route.js                  ← GET (paginated list) + DELETE (bulk)
│   │   └── webhook/happierleads/route.js   ← inbound webhook, dedup, insert
│   ├── filtered/page.jsx                   ← Filtered tab (tabs-pill, debounced search)
│   ├── leads/page.jsx                      ← Leads tab (expandable rows, checkboxes, tooltips)
│   ├── page.jsx                            ← Overview tab (stat cards, pipeline status, recent leads)
│   ├── layout.jsx                          ← server root layout
│   └── globals.css
├── components/
│   ├── ClientLayout.jsx                    ← client wrapper (mobile sidebar state)
│   ├── EmptyState.jsx                      ← first-time onboarding guide (4 setup steps)
│   ├── Sidebar.jsx                         ← nav with Growleads logo + 3 items
│   └── StatsBar.jsx                        ← legacy stat cards (used nowhere currently)
├── styles/
│   ├── reference.css                       ← Growleads design system (do not edit)
│   └── custom.css                          ← all app-specific overrides and additions
└── lib/
    └── db.js                               ← Neon sql tagged-template client
public/
└── growleads-logo.png                      ← sidebar logo
```

## Next Steps (Phase 2)

- Wire up "Push to Smart Lead" button — needs Smart Lead API key + contact import endpoint
- Add `PATCH /api/leads/[id]/push` route that calls Smart Lead and sets `pushed_to_smart_lead = true`
- Vercel deploy — push to GitHub, connect repo, add DATABASE_URL env var, update HL webhook URL

# Context — Running Changelog

This file is updated after every change, fix, or feature addition.
Read this first when resuming work to get back up to speed.

---

## 2026-04-23 — Mobile responsive hardening (filter inputs, table scroll, touch targets)

- What changed:
  - Filter bar inputs had `style={{ width: 220px / 140px }}` as inline styles — added `!important` CSS override so they go full-width at 768px.
  - Table gets `min-width: 640px` + `-webkit-overflow-scrolling: touch` so columns stay readable and swipe-scroll works on iOS.
  - Pagination buttons bumped to `40×40px` for easier tapping.
  - Page header wraps at 480px so the count doesn't collide with the title.
  - Person name truncates with `…` at 480px instead of overflowing.
  - Tabs pill wraps on very small screens.
- Why: previous pass missed inline-style width overrides and table column collapse on phones.
- Files affected: `src/styles/custom.css`.

## 2026-04-23 — Login page logo fix + subtitle + session cookie

- What changed:
  - Login logo: removed the blue wrapper container — favicon already is the blue rounded square, so wrapping it created a double box. Now renders the 52px `favicon.png` directly with `borderRadius: 12px`.
  - Login subtitle changed from "Dashboard" to "Website Traffic Signal" to match the actual product name.
  - Removed `maxAge` from `gl_session` cookie — it is now a session cookie that expires when the browser closes, requiring login on every new session.
- Why: visual double-box bug; subtitle mismatch; user wants fresh login on every browser open for security.
- Files affected: `src/app/login/page.jsx`, `src/app/api/auth/login/route.js`, `src/styles/custom.css`.

## 2026-04-23 — Password protection + initial mobile pass

- What changed:
  - Added password gate (password: `Growleads@admin`). All app routes redirect to `/login` unless `gl_session` cookie is set. Webhook endpoint stays public.
  - Login page at `/login` matches Growleads brand design: dark bg, centered card with icon/title, password field with eye toggle, blue Sign-in button.
  - Login sidebar skipped — `ClientLayout` returns children directly for `/login`.
  - Added mobile polish: at 480px, reduced padding, smaller stat card values, wrapping recent-lead-rows.
- Why: internal-only tool, password gate prevents unwanted access; phone usability request.
- Files affected: `src/middleware.js` (new), `src/app/api/auth/login/route.js` (new), `src/app/login/page.jsx` (new), `src/components/ClientLayout.jsx`, `src/styles/custom.css`.

## 2026-04-23 — Logo size fix + tab title rename

- What changed: Reduced collapsed sidebar logo from 40px → 28px so it's proportional to the nav icons. Renamed browser tab title from "Growleads — Lead Dashboard" to "Website Traffic Signal".
- Why: Logo was too large in collapsed state. User wants the tab title to reflect the product name with no em dash.
- Files affected:
  - `src/styles/custom.css` — `.sidebar-collapsed .sidebar-brand-icon img { width: 28px; height: 28px; }`
  - `src/app/layout.jsx` — title updated

---

## 2026-04-23 — Sidebar brand redesign + favicon

- What changed: Replaced `growleads-logo.png` with `favicon.png`. Redesigned sidebar brand area to match Heyreach reference: horizontal row — `[icon 40px]` | `[Growleads bold / page label muted]` | `[< collapse btn]`. Page label is dynamic (Overview / Leads / Filter) via `usePathname`. Updated browser tab favicon and page title to "Growleads — Lead Dashboard".
- Why: User provided reference screenshots showing icon + two-line text stack (name above, section label below) in a row, with collapse chevron at far right.
- Files affected:
  - `public/favicon.png` — new logo (copied from user's Downloads, replaces growleads-logo.png)
  - `src/app/layout.jsx` — `metadata.icons: { icon: '/favicon.png' }`, title updated
  - `src/components/Sidebar.jsx` — brand area: icon + `.sidebar-brand-stack` (name + sub) + collapse btn in a flex row; mobile close btn appended when `open`
  - `src/styles/custom.css` — `.sidebar-brand` padding/gap, `.sidebar-brand-icon` 40px, `.sidebar-brand-stack` flex-column, `.sidebar-brand-name` 14px bold, `.sidebar-brand-sub` 11px muted

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

## 2026-04-22 — Pushed to GitHub

- What changed: Initialized git repo, created README.md, created public GitHub repo, pushed all 28 files as initial commit
- Repo: https://github.com/karanpaliwall/happier-leads-automation
- `.env.local` excluded (in .gitignore) — credentials never committed
- README covers: what it does, feature list, stack, setup steps (install → schema → ngrok → HL config), all routes, Vercel deploy instructions, Phase 2 placeholder note
- Files affected: `README.md` (created), git history initialized

## 2026-04-22 — Deployed to Vercel

- What changed: Production deployment live on Vercel
- URL: https://happier-leads-automation.vercel.app
- `DATABASE_URL` added to Vercel production environment via CLI
- Build passes clean on Vercel (Next.js 16.2.4, Turbopack, Washington DC / iad1 region)
- `/api/leads` smoke-tested against live URL — returns correct data from Neon DB
- Files affected: `.vercel/` directory created (linked project config, gitignored)

## 2026-04-22 — Happier Leads webhook updated to Vercel URL + README updated

- What changed: Webhook URL in Happier Leads Automations updated from ngrok → `https://happier-leads-automation.vercel.app/api/webhook/happierleads`. Test webhook confirmed successful (green "Success" banner in HL UI). README updated with live production URL prominently at the top and Vercel CLI deploy instructions.
- Why: ngrok URL changes on every restart; Vercel URL is permanent
- Pipeline is now fully live with no local dependency
- Files affected: `README.md`

## 2026-04-22 — Collapsible sidebar

- What changed: Desktop sidebar is now collapsible. A chevron toggle button in the brand area collapses the sidebar to 60px (icons only) and expands it back to 240px. Smooth CSS transition on width and main-content margin. "Filtered" nav label renamed to "Filter". Mobile behavior unchanged (hamburger overlay still used on ≤768px).
- Why: User requested collapsible sidebar for more screen real estate
- Files affected: `src/components/Sidebar.jsx`, `src/components/ClientLayout.jsx`, `src/styles/custom.css`

## 2026-04-22 — Fit score fix + 10s polling + HL API sync route

- What changed:
  - Webhook + backfill now try `s.fitScore ?? s.score` — real payloads use `fitScore`, HL test payloads use `score`. Both fields now handled.
  - Polling interval reduced from 30s → 10s on all three pages (Overview, Leads, Filter)
  - `POST /api/admin/sync-from-hl` created — fetches leads from Happier Leads REST API by date range and upserts them with the same dedup logic as the webhook. Requires `HL_API_KEY` env var.
  - Backfill ran on production (`{"ok":true,"updated":2}`) — Niclas Österling test lead now shows correct fit score (9/30)
- Why: HL test webhook uses `s.score` field name, real webhooks use `s.fitScore`; missed both
- Files affected: `src/app/api/webhook/happierleads/route.js`, `src/app/api/admin/backfill-scores/route.js`, `src/app/api/admin/sync-from-hl/route.js` (created), all three page.jsx files

## 2026-04-22 — Niclas Österling test lead explained

- The "Niclas Österling / ibm-test-company.com" lead is a **synthetic test payload** sent by Happier Leads when the "Test Webhook (POST Request)" button is clicked in Automations. It uses fake data (`@test.com` email, fake IBM domain). It will never appear in HL's real leads list. Delete it via the bulk-delete checkbox on the Leads page if desired.

## 2026-04-23 — Performance: instant row expansion + fewer DB queries

- What changed:
  - `GET /api/leads` list query now uses `COUNT(*) OVER()` window function — 2 DB queries per poll instead of 3 (eliminated separate `COUNT(*)` query)
  - `raw_payload` re-included in list response so row expansion is instant (data already on client, no second network call)
  - `GET /api/leads/[id]` single-lead endpoint also created (not used by UI currently but available)
- Why: An earlier iteration fetched raw_payload on-demand per row expand, causing 1-3s cold-start lag on every expansion. Reverted to inline approach with the query count optimisation.
- Files affected: `src/app/api/leads/route.js`, `src/app/api/leads/[id]/route.js` (created), `src/app/leads/page.jsx`

## 2026-04-23 — Happier Leads automation confirmed correctly configured

- Automation settings verified: When = "A new lead is identified", Then = "Trigger webhook", Visits = "Only on first visit", Segment = "All leads", URL = Vercel production endpoint.
- The 2 existing leads in the DB ("Niclas Österling" and "Joe Recomendes") are both synthetic test payloads created by clicking "Test Webhook (POST Request)" in HL Automations. Neither appears in the real HL leads list.
- Pipeline is live. New real visitors to the tracked site will flow into the dashboard automatically going forward.

## 2026-04-23 — Performance: instant tab switching + no sidebar flash

- What changed:
  - **Module-level cache** added to all three pages — on navigation back to a page, last-known data shows instantly (no blank/zero state) while the background fetch refreshes
  - **Sidebar/logo expand flash fixed** — `transition: width 0.22s ease` and `transition: margin-left 0.22s ease` now only apply under `.app-mounted` class. `ClientLayout` adds this class after first `useEffect` (post-hydration). Prevents CSS transition firing during initial browser render.
  - Overview subtitle corrected: "auto-refreshes every 30s" → "auto-refreshes every 10s"
- Why: Each page remounted on navigation, resetting state to empty defaults and showing 0s until the API responded. CSS transitions were firing during hydration causing visible sidebar animation on every hard reload.
- Files affected: `src/components/ClientLayout.jsx`, `src/styles/custom.css`, `src/app/page.jsx`, `src/app/leads/page.jsx`, `src/app/filtered/page.jsx`

## 2026-04-23 — Sidebar: defaults collapsed + Heyreach-style brand area

- What changed:
  - Sidebar now starts **collapsed** (60px icon-only) by default on every hard reload
  - Brand area redesigned: logo icon (fixed 38×38px) + dynamic page name subtitle — no "Growleads" text
  - Dynamic subtitle reads `usePathname()` and shows the active page label (`Overview`, `Leads`, `Filter`)
  - Collapsed brand area centered correctly; collapse button always visible
- Why: Logo was "expanding" on every reload due to the CSS width transition firing during hydration. Defaulting to collapsed means the logo image never renders until the user explicitly expands, eliminating the flash entirely.
- Files affected: `src/components/Sidebar.jsx`, `src/components/ClientLayout.jsx`, `src/styles/custom.css`

## 2026-04-23 — UI polish: badges, avatars, score bars, row states

- What changed:
  - **Badges** — Exact (green) and Suggested (orange) now have a subtle border + slightly brighter text for more contrast
  - **Avatars** — gradient background + border ring for visual depth
  - **Score bars** — 5px tall (was 4px), smoother fill transition
  - **Expanded row** — blue left-border accent (2px, rgba blue) instead of plain background, clearly marks which row is open
  - **Row hover** — softer rgba value for subtler feel
- Why: User requested general UX polish pass
- Files affected: `src/styles/custom.css`

## Workflow Convention (as of 2026-04-22)

All changes are made locally and immediately committed + pushed to GitHub (`main`). Vercel auto-deploys on every push. **Do not test against localhost — always verify against https://happier-leads-automation.vercel.app.**

## Current Status

- [x] `npm install` — done (Next.js 16.2.4, React 19.2.5)
- [x] Build passes clean — `npm run build` succeeds
- [x] CLAUDE.md created
- [x] Neon DB schema — created (leads table + 3 indexes, production branch)
- [x] Happier Leads automation — created and activated, webhook confirmed working (permanent Vercel URL)
- [x] First webhook received and payload confirmed — field extraction updated in webhook/route.js
- [x] Three-tab UI — Overview / Leads / Filter routes
- [x] Growleads logo in sidebar
- [x] Expandable lead rows — all Happier Leads data visible (contact, company, scores, visits, UTM)
- [x] Mobile responsive — hamburger menu + sidebar overlay
- [x] Collapsible sidebar — defaults collapsed on load, chevron toggle, 60px icon-only or 240px full
- [x] Sidebar brand area — logo only (38px), dynamic page name subtitle (changes per route), no text clutter
- [x] Checkbox multi-select + bulk delete on Leads page
- [x] DELETE /api/leads endpoint
- [x] Fit Score + Engagement tooltips (position:fixed, never clipped)
- [x] Engagement score calculated from visit data (not null anymore)
- [x] Fit score extraction tries s.fitScore ?? s.score (handles both real + test payloads)
- [x] Backfill endpoint — POST /api/admin/backfill-scores (fixes existing leads)
- [x] HL API sync endpoint — POST /api/admin/sync-from-hl (requires HL_API_KEY env var)
- [x] GET /api/leads/[id] — single-lead endpoint with full raw_payload
- [x] Next.js devtools button hidden (devIndicators: false)
- [x] First-time empty state — onboarding guide on Overview + Leads pages when no leads exist
- [x] GitHub — https://github.com/karanpaliwall/happier-leads-automation
- [x] Production — https://happier-leads-automation.vercel.app

## Architecture — current file map

```
src/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── backfill-scores/route.js    ← recalculates fit+engagement from raw_payload
│   │   │   └── sync-from-hl/route.js       ← imports leads from HL REST API (needs HL_API_KEY)
│   │   ├── leads/
│   │   │   ├── route.js                    ← GET (paginated, window-fn count) + DELETE (bulk)
│   │   │   └── [id]/route.js               ← GET single lead with full raw_payload
│   │   └── webhook/happierleads/route.js   ← inbound webhook, dedup, insert
│   ├── filtered/page.jsx                   ← Filter tab (tabs-pill, debounced search)
│   ├── leads/page.jsx                      ← Leads tab (expandable rows, checkboxes, tooltips)
│   ├── page.jsx                            ← Overview tab (stat cards, pipeline status, recent leads)
│   ├── layout.jsx                          ← server root layout
│   └── globals.css
├── components/
│   ├── ClientLayout.jsx                    ← client wrapper (sidebar open + collapsed state)
│   ├── EmptyState.jsx                      ← first-time onboarding guide (4 setup steps)
│   ├── Sidebar.jsx                         ← collapsible nav with Growleads logo + 3 items
│   └── StatsBar.jsx                        ← legacy stat cards (unused)
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

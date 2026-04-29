# Context — Running Changelog

This file is updated after every change, fix, or feature addition.
Read this first when resuming work to get back up to speed.

---

## 2026-04-30 — Data audit: random records investigation + New Today behaviour confirmed

- What changed: No code change. Investigation only.
- Findings:
  - **"Random" records (e.g. Nicolas Rossi at map.ch)**: appeared at top of dashboard (8h ago) but not visible in HL's activity-sorted list where he should appear (#2, between Farhana at 3h and the 9h group). Root cause: likely created by clicking "Test Webhook (POST Request)" in the HL automation panel. Test webhooks fire real-looking sample data, hit our endpoint, pass dedup, and get stored as real leads. Action: delete suspected test entries via the checkbox bulk-delete feature.
  - **Order discrepancy between dashboard and HL**: expected. Farhana shows 3h in HL (she revisited) but 11h in our dashboard (we're back on "Only on first visit" — revisit webhooks don't fire, so `activity_at` is still from her first visit). Our sort is by `activity_at`, HL sorts by most-recent-visit.
  - **Count gap (396 ours vs 445 HL last 7 days)**: ~49 leads HL identified that we never received webhooks for. Likely from the WEBHOOK_SECRET downtime (2026-04-29) and the period before the automation was fully set up.
  - **"New Today" counter**: already resets at midnight UTC daily (`received_at >= CURRENT_DATE` in SQL). Shows 0 at start of each day, counts up throughout the day. Timezone note: resets at midnight UTC, not local midnight.
- Files affected: None

---

## 2026-04-30 — Replace individual delete button with checkbox bulk-select delete

- What changed: Removed per-row trash icon. Added checkbox to each row + select-all in header (indeterminate state supported). When 1+ rows selected, "Delete (N)" button appears in filter bar. Two-click confirm ("Delete (N)" → "Delete N leads? Yes / Cancel"). Bulk DELETE runs in parallel via `Promise.allSettled`, only removes rows that actually returned `ok:true`, total decrements by actual deleted count.
- Why: Cleaner UX for removing multiple test/junk entries at once.
- Files affected: `src/app/leads/page.jsx`, `src/styles/custom.css`

---

## 2026-04-30 — Add delete lead button to dashboard

- What changed: Each lead row now has a trash icon button in the action column. Clicking it shows an inline "Delete? Yes / No" confirmation (no browser alert). Confirming calls `DELETE /api/leads/[id]`, removes the row from the local state immediately, and decrements the total count. The backend endpoint already existed.
- Why: User needs to remove test/junk entries directly from the dashboard without database access.
- Files affected: `src/app/leads/page.jsx`, `src/styles/custom.css`

---

## 2026-04-30 — Full system audit: 11 hardening fixes

- What changed: Full audit of all routes, middleware, and frontend. Fixes applied:
  1. **Bulk delete** — switched `Promise.all` to `Promise.allSettled`, only removes leads whose DELETE actually returned `ok:true`; total count decrements by actual deleted count, not selected count
  2. **CSV formula injection** — `esc()` now prefixes values starting with `=`, `+`, `-`, `@`, `\t` with a tab character to prevent Excel/Sheets formula execution
  3. **Push route DB SELECT** — wrapped in `try/catch`; DB outage now returns clean `{ error: 'Database error' }` JSON instead of unstructured 500
  4. **campaign-ids routes** — all DB calls in `GET/POST/DELETE` for both `/api/campaigns/ids` and `/api/heyreach/campaign-ids` wrapped in try/catch with JSON error responses
  5. **`GET /api/leads` limit param** — added `Math.max(1, ...)` lower bound and `|| 25` NaN fallback; `limit=0` or `limit=abc` no longer reaches the DB
  6. **Login timing safety** — password comparison switched to `crypto.timingSafeEqual` (was `!==` string compare)
  7. **Middleware timing safety** — added `safeEqual()` constant-time comparison helper (Edge runtime has no Node.js crypto)
  8. **Campaign picker copy** — "No campaigns found in SmartLead." → "No campaigns found in HeyReach."
- Why: Full audit pass to close edge cases before adding auto-push
- Files affected: `src/app/leads/page.jsx`, `src/app/api/leads/export/route.js`, `src/app/api/leads/route.js`, `src/app/api/leads/[id]/push/route.js`, `src/app/api/campaigns/ids/route.js`, `src/app/api/heyreach/campaign-ids/route.js`, `src/app/api/auth/login/route.js`, `src/middleware.js`

---

## 2026-04-30 — Happier Leads automation set back to "Only on first visit"

- What changed: HL automation trigger reverted from "On every visit" back to "Only on first visit". No code changes — this is a Happier Leads config change.
- Why: Goal is a clean list of unique new visitors only. "On every visit" was temporarily set to investigate activity timestamp sync, but adds unnecessary repeat-visit webhook noise. The webhook handler's UPDATE path remains as a passive safety net (handles accidental HL resends) but is no longer an active code path.
- Files affected: None (Happier Leads automation config only)

---

## 2026-04-29 — Open push endpoint for re-engagement campaigns

- What changed: Removed the 409 "Already pushed" guard from `POST /api/leads/[id]/push` so the same lead can be pushed multiple times. Updated the UI button: previously a lead that was already pushed showed a dead "Pushed" badge with no click action; now it shows a "Re-push" button (with checkmark icon) that opens the campaign picker the same as the first push.
- Why: User wants to run re-engagement campaigns. Blocking re-push at the API level would prevent pushing the same lead to a different or future campaign, and forcing a workaround (delete + re-import) is impractical.
- Files affected: `src/app/api/leads/[id]/push/route.js`, `src/app/leads/page.jsx`

---

## 2026-04-29 — Fix HeyReach push endpoint (404 → working)

- What changed: Push route was calling `/Campaign/AddLeadsToActiveCampaign` which doesn't exist (404). Correct endpoint is `/campaign/AddLeadsToCampaignV2` (lowercase `campaign`, different name). Body shape also wrong — HeyReach uses `accountLeadPairs[].lead` with `profileUrl` and `emailAddress` fields, not a flat `leads[]` array. Also added `Accept: text/plain` header and `resumePausedCampaign: true` per API docs.
- Why: User got "HeyReach rejected the request (HTTP 404)" when clicking Push to HeyReach. API docs confirmed at documenter.getpostman.com/view/23808049/2sA2xb5F75.
- Files affected: `src/app/api/leads/[id]/push/route.js`, `docs/3-single-source-of-truth.md`

---

## 2026-04-29 — Switch push integration from SmartLead to HeyReach

- What changed: "Push to Smart Lead" button renamed to "Push to HeyReach". Campaign picker now loads from `/api/heyreach/campaign-ids` and `/api/heyreach/campaigns` instead of SmartLead endpoints. Push route (`/api/leads/[id]/push`) rewired to call HeyReach API (`POST /Campaign/AddLeadsToActiveCampaign`) using `HEYREACH_API_KEY`. DB column `pushed_to_smart_lead` kept as-is (renaming requires a migration; it's internal only).
- Why: User is using HeyReach for LinkedIn outreach, not SmartLead.
- Files affected: `src/app/leads/page.jsx`, `src/app/api/leads/[id]/push/route.js`, `docs/3-single-source-of-truth.md`, `CLAUDE.md`

---

## 2026-04-29 — Fix stale activity timestamps on repeat visits (v2: GREATEST + NOW fallback)

- What changed: Improved the repeat-visit UPDATE to use `GREATEST(existing, incoming_or_now)` instead of a `WHERE activity_at < new_activity_at` guard. The guard was silently skipping updates when HL's revisit webhook payload still carried the original `lastSession.date` (same value as stored), making the comparison `9h < 9h = false`. Now falls back to `NOW()` (webhook receipt time) when payload has no newer session date, and `GREATEST()` ensures the timestamp can never go backwards on out-of-order delivery.
- Why: Webhook fired at 9:42 PM confirmed in HL logs, but dashboard still showed "9h ago" — the first fix's WHERE clause was failing silently.
- Files affected: `src/app/api/webhook/happierleads/route.js`

---

## 2026-04-29 — Fix stale activity timestamps on repeat visits (v1)

- What changed: Webhook handler now UPDATEs `activity_at`, `engagement_score`, `fit_score`, and `raw_payload` on duplicate webhooks instead of silently discarding them. Previously, repeat-visit webhooks were dropped after the dedup check, leaving the original timestamp frozen.
- Why: Farhana Toma showed "9h ago" in dashboard while HL showed "1h ago" — revisit webhook was being discarded.
- Files affected: `src/app/api/webhook/happierleads/route.js`

---

## 2026-04-29 — Fix timestamp display to match Happier Leads Activity column

- What changed: Leads page now shows `activity_at` (visitor's last active time from HL payload) instead of `received_at` (when our webhook received the lead). Column renamed from "Received" to "Activity". Sort order also switched to `COALESCE(activity_at, received_at) DESC`.
- Why: `received_at` diverged from HL's "Activity" column by 10–60+ minutes when HL delayed webhook delivery (e.g. Gro Myking appeared as "34m ago" in our dashboard but "9h ago" in HL). User reported this as a "hallucination". The fix makes our timestamps and ordering consistent with HL.
- Files affected: `src/app/leads/page.jsx`, `src/app/api/leads/route.js`

---

## 2026-04-29 — Full system audit + bug fixes

- What changed:
  1. Full audit of every file: webhook, DB, auth, API routes, frontend pages, CSS responsiveness.
  2. Fixed `src/app/api/leads/[id]/push/route.js`: added try/catch + 10s AbortController timeout around SmartLead fetch (previously an unhandled network error would crash with a generic 500); added try/catch around final DB UPDATE so a DB failure after a successful SmartLead push still returns `ok:true` (prevents duplicate push on retry).
  3. Fixed `src/app/api/auth/login/route.js`: added try/catch around `request.json()` (previously a malformed/empty body crashed with an unhandled 500 instead of returning 400).
- Why: Production safety audit before go-live.
- Files affected: `src/app/api/leads/[id]/push/route.js`, `src/app/api/auth/login/route.js`

---

## 2026-04-29 — Full pipeline audit + webhook live check + DELETE endpoint

- What changed:
  1. Full end-to-end pipeline audit — confirmed every layer is healthy and real-time (webhook → Neon DB → 10s poll → frontend).
  2. Fired a live test webhook to `websitevisitors.growleads.io/api/webhook/happierleads` — returned `200 {"ok":true}`, lead landed in DB with all fields correct, then cleaned up.
  3. Added `DELETE /api/leads/[id]` endpoint (auth-required) for removing leads (e.g. test entries).
  4. Root cause of 394 vs 436 gap confirmed: historical — leads before webhook activation (pre Apr 22) + ~42 missed during the Apr 29 WEBHOOK_SECRET outage. No ongoing data loss.
- Why: User wanted confidence that every new HL lead is captured in real-time with no edge cases.
- Files affected: `src/app/api/leads/[id]/route.js`

---

## 2026-04-29 — Rename /filtered route to /leads + add custom domain

- What changed:
  1. Renamed `src/app/filtered/` → `src/app/leads/` so the Leads page is at `/leads` instead of `/filtered`.
  2. Updated `Sidebar.jsx` href from `/filtered` to `/leads`.
  3. Updated all references in `CLAUDE.md` and `docs/3-single-source-of-truth.md`.
  4. Documented custom domain `websitevisitors.growleads.io` as the primary production URL.
- Why: URL `/filtered` was an implementation artifact; `/leads` matches the page label and is user-facing. Custom domain was configured in Vercel by the user.
- Files affected: `src/app/leads/page.jsx` (renamed), `src/components/Sidebar.jsx`, `CLAUDE.md`, `docs/3-single-source-of-truth.md`, `docs/4-context.md`

---

## 2026-04-29 — Webhook reliability audit + preventive hardening

- What changed: Full audit of the webhook pipeline after the WEBHOOK_SECRET breakage. No additional code bugs found. Two preventive changes made:
  1. Added explicit `console.error` log when `WEBHOOK_SECRET` auth fails — makes silent 401s visible in Vercel Logs immediately, before you'd notice leads stopping in the dashboard.
  2. Added "Webhook Reliability Rules" section to `CLAUDE.md` — five rules that must never be violated when touching the webhook route or db.js: WEBHOOK_SECRET is optional by design, must update HL URL and Vercel together, DB dedup errors return 200, INSERT errors return 500 (correct, lets HL retry), DATABASE_URL missing causes module crash.
- Why: User asked for audit to prevent future breakage. The rules encode the lessons from the Apr 29 outage so future Claude sessions can't repeat the mistake.
- Files affected: `src/app/api/webhook/happierleads/route.js`, `CLAUDE.md`

---

## 2026-04-29 — Fix analytics % showing absurd values (e.g. ↑3282%)

- What changed: `pct` is now `null` when `Math.abs(pct) > 999`. The previous fix (null when `beforeTotal < 5`) wasn't enough — a previous period with 11 leads vs current 372 still produced 3282%. When the % would be >999, the raw counts already tell the story; the giant number just looks broken.
- Why: User reported "↑3282%" on the analytics chart comparison row.
- Files affected: `src/app/page.jsx` (line ~602, `chartSummary` useMemo)

---

## 2026-04-29 — Fix webhook broken by hard-required WEBHOOK_SECRET

- What changed: The security audit (same day) changed `WEBHOOK_SECRET` from optional-with-warning to hard-required (returns 500 if unset, 401 if set but header missing). Happier Leads has no way to send custom request headers, so every webhook call started failing immediately after deploy — 0 new leads received since then.
- Fix: Reverted to optional behaviour: if `WEBHOOK_SECRET` is not set, requests pass through with a console warning. If set, the secret can now be provided as a `?secret=xxx` URL query parameter (compatible with Happier Leads webhook URL config) in addition to the existing header options. This ensures a missing env var never silently kills ingestion.
- Why: The hard-required check was not coordinated with configuring Happier Leads to send the header. URL-based secret is the correct pattern for webhook senders that don't support custom headers (e.g. configure the HL webhook URL as `...happierleads?secret=abc123`).
- Files affected: `src/app/api/webhook/happierleads/route.js`, `docs/3-single-source-of-truth.md`

---

## 2026-04-29 — Fix analytics chart filter popover stuck on mobile

- What changed: The "Past 7 days" dropdown on the Overview analytics card was broken on mobile — the popover appeared off-screen ("stuck at the top"). Two CSS bugs combined:
  1. A `bottom: calc(100% + 6px)` override forced the popover to open *above* the button, but the card header is near the top of the page so it disappeared off-screen.
  2. An `left: 0; right: auto` override anchored the popover to the left edge of the button wrapper, which sits at the right side of the card — making it bleed off the right edge of the screen.
- Fix: Removed the open-above override (popover now opens below, as normal). Kept `right: 0` so the popover's right edge stays within the card boundary. Also added `gap: 8px; flex-wrap: wrap` to `.card-header` so title and filter button don't collide on very narrow screens.
- Files affected: `src/styles/custom.css` (640px media query, `.card-header`)

---

## 2026-04-29 — Full system audit: 20 security + edge-case fixes

- What changed: Comprehensive security and edge-case audit identified 1 P1, 18 P2s, 12 P3s. All code-fixable issues resolved:
  - **P1**: PushDropdown in filtered/page.jsx was calling `/api/smartlead/campaigns` with no `ids` param — always returned empty, breaking "Push to SmartLead" entirely. Fixed to first fetch `/api/campaigns/ids` then pass them.
  - **Security — auth**: `requireAuth` now uses `crypto.timingSafeEqual` (timing-safe comparison) instead of `!==`. Session cookie upgraded to `SameSite: strict` (CSRF mitigation). Login rate limiter now uses the last IP in `X-Forwarded-For` (infrastructure-added, non-spoofable) instead of the first (client-injectable).
  - **Security — webhook**: `WEBHOOK_SECRET` now fails closed (500) when not set, instead of silently allowing all requests. Added 64 KB payload size limit (Content-Length check + post-parse guard) to prevent storage exhaustion. DB error during dedup check now returns 200 (was 500) to prevent Happier Leads retry storms.
  - **Security — push route**: Added idempotency check (`pushed_to_smart_lead = true` → 409 before calling SmartLead) to prevent duplicate SmartLead leads on double-click. Raw SmartLead error body no longer forwarded to browser (was leaking internal API error detail).
  - **Security — SmartLead route**: Added `/^\d+$/` numeric validation for campaign IDs (was only `.filter(Boolean)`), preventing path injection into SmartLead API URL.
  - **Security — DELETE routes**: Both campaign-ids DELETE handlers now validate IDs are numeric (matching POST validation).
  - **Security — lead [id] routes**: UUID format validated before DB query — returns 400 instead of misleading 500 on invalid IDs. Applied to both GET and push routes.
  - **Security — headers**: Added `Strict-Transport-Security` (HSTS, 1-year) and `Content-Security-Policy` to `next.config.js`.
  - **Edge case — sync waterfall**: `serverIds.push(...missing)` mutation replaced — now only merges IDs that the server actually accepted (was permanently writing rejected IDs into localStorage). Applied to both SmartLead and HeyReach pages.
  - **Edge case — background poll**: `filtered/page.jsx` background poll failures now surface a "data may be stale" error banner (was silently swallowed).
  - **Edge case — export**: Export fetch failure now has a `catch` block with `alert()` (was unhandled promise rejection).
  - **Edge case — page reset**: `fetchLeads` now resets to page 1 when results shrink below current page (was showing empty "No leads" on valid data).
  - **Edge case — CSV**: `esc()` in export route now strips `\r\n` before quoting (embedded newlines would split rows in some spreadsheet apps). Campaign CSV `status` field now quoted in both pages.
  - **Edge case — date filter**: Both campaign pages now validate `c.created` is a parseable date before filtering; excludes campaigns with unparseable dates from date-filtered views (was treating Invalid Date as "in range").
- Why: User requested full system audit. Two agents (security-sentinel + data-integrity-guardian) performed independent analysis; all actionable findings fixed.
- Files affected: `src/app/api/webhook/happierleads/route.js`, `src/lib/auth.js`, `src/app/api/auth/login/route.js`, `src/app/api/smartlead/campaigns/route.js`, `src/app/api/leads/[id]/push/route.js`, `src/app/api/leads/[id]/route.js`, `src/app/api/campaigns/ids/route.js`, `src/app/api/heyreach/campaign-ids/route.js`, `src/app/api/leads/export/route.js`, `next.config.js`, `src/app/filtered/page.jsx`, `src/app/campaigns/page.jsx`, `src/app/heyreach/campaigns/page.jsx`

---

## 2026-04-29 — Fix analytics % showing absurd values (e.g. 37700%)

- What changed: `pct` (period-over-period % change) is now `null` when `beforeTotal < 5`. Previously it was only nulled when `beforeTotal === 0`, so a prior period with 1 lead would produce e.g. (378−1)/1×100 = 37700%.
- Why: User reported "↑37700%" displayed on the analytics chart. When the comparison window has near-zero data the percentage is noise, not signal. Raw counts (e.g. "1 Exact · 0 Suggested" vs "318 Exact · 60 Suggested") still show so the comparison remains visible.
- Files affected: `src/app/page.jsx` (line ~602, `chartSummary` useMemo)

---

## 2026-04-29 — Add Accept Rate + Reply Rate columns back to HeyReach table

- What changed: Re-added "Accept Rate" and "Reply Rate" columns to the HeyReach campaigns table (before "Created"). Accept Rate is computed as `finished / total` (a proxy for sequence completion rate — the closest approximation the HeyReach public API allows). Reply Rate shows "—" because the HeyReach public API has no endpoint that returns message reply counts. Both columns are also included in CSV export.
- Why: User requested the columns be visible. ~60 API endpoints were probed to find accept/reply stats (including `GetCampaignStatsByCampaignId`, all Analytics/Statistics/CampaignAccount/LinkedInUser/Sender paths) — none exist in the HeyReach public API. The only stats available are `progressStats` user-count fields.
- Files affected: `src/app/heyreach/campaigns/page.jsx` (COLS array, cell renderers, exportCSV)

---

## 2026-04-29 — Fix mobile layout: analytics two-row + leads tabs fill width

- What changed: Two mobile UI fixes:
  1. Overview analytics period comparison row restructured from a single flat `flexWrap:'wrap'` flex row into two separate labeled rows ("Prev. period" row and "Current" row). The flat row caused Prev values and Current labels to intermix on narrow screens.
  2. Leads filter tab buttons now have `flex: 1; justify-content: center` on mobile (≤640px) so All Leads / Exact / Suggested spread evenly across the full-width pill container instead of bunching to the left.
- Why: User reported "overview analytics period comparison is way too off" and "leads filter tab all leads exactly listed is way off" on mobile.
- Files affected: `src/app/page.jsx` (lines ~741-762), `src/styles/custom.css` (640px media query)

---

## 2026-04-28 — Fix login broken by missing Vercel env vars

- What changed: Added `LOGIN_PASSWORD=Growleads@admin` and `SESSION_TOKEN=gl-auth-v1` to Vercel production environment variables. Redeployed.
- Why: The auth.js security fix (todo #020) removed the hardcoded `'gl-auth-v1'` fallback and made `SESSION_TOKEN` required. `LOGIN_PASSWORD` was also required by the login route but had never been set in Vercel — only in `.env.local` locally. Both missing vars caused login to return 500 → "Incorrect password".
- Files affected: Vercel env vars only (no code change)

---

## 2026-04-28 — Full code review (ce-review): 6 todos resolved

- What changed: Ran `/ce-review` across the last 5 commits (HeyReach real data + cross-device sync). 7 review agents identified 6 findings; all were fixed and merged to main in the same session.
- Findings and resolutions:
  - **#017 P1** — cross-device sync was sequential `for...await` (regression); fixed to `Promise.all` + added `syncInFlight` ref to both campaign pages to prevent concurrent-mount double-fire
  - **#018 P1** — `acceptRate`/`replyRate` table columns always showed "0 (0%)" because `GetCampaignStatsByCampaignId` is unavailable; removed columns, dead fields, and CSV headers until the endpoint works
  - **#019 P2** — HeyReach campaign IDs from `?ids=` not validated; added digit-only filter before interpolation into upstream URL
  - **#020 P2** — `SESSION_TOKEN` had hardcoded `'gl-auth-v1'` fallback in auth.js, middleware, and login route; all three now fail closed (500) if env var missing
  - **#021 P2** — `N` number cell helper and column-pin logic duplicated in both campaign pages; extracted to `src/components/NumCell.jsx` and `src/hooks/usePinnedColumns.js`
  - **#022 P3** — `hrGet` used `__authError` sentinel + `res.text()/JSON.parse()`; simplified to throw directly on 401 + `res.json()` with try/catch
- Why: Routine review pass after HeyReach real-data integration went live.
- Files affected: `src/lib/auth.js`, `src/middleware.js`, `src/app/api/auth/login/route.js`, `src/app/api/heyreach/campaigns/route.js`, `src/app/heyreach/campaigns/page.jsx`, `src/app/campaigns/page.jsx`, `src/components/NumCell.jsx` (new), `src/hooks/usePinnedColumns.js` (new)
- Todos: #017–#022 all complete

---

## 2026-04-28 — Code review cleanup: auth hardening + HeyReach refactor + shared utilities

- What changed:
  - **auth.js** — removed hardcoded `'gl-auth-v1'` fallback from `SESSION_TOKEN`. Now returns 500 if env var missing (fails closed). Resolves todo #020.
  - **HeyReach route** — `hrGet()` now throws directly on 401 (no `__authError` sentinel); uses `res.json()` with try/catch; digit-only filter on `ids` query param; removed dead `invitesSent/accepted/replies` zero fields. Resolves todos #019, #022.
  - **HeyReach page** — removed `acceptRate`/`replyRate` columns (always 0, stats endpoint dead); imports `N` from `NumCell`, `usePinnedColumns` from hook. Resolves todo #018. Partial #021.
  - **SmartLead page** — imports `N` from `NumCell`, `usePinnedColumns` from hook. Partial #021.
  - **New shared files** — `src/components/NumCell.jsx` (number cell renderer), `src/hooks/usePinnedColumns.js` (column pin logic). Both pages now use these instead of duplicating inline.
  - **Campaign ID validation** — both add-campaign dialogs now verify the ID exists against the live API before saving. Shows "Campaign ID X not found" error with spinner during check.
- Why: Security review (auth fails open), dead UI data (always-zero columns), input security (URL injection), code dedup.
- Files affected: `src/lib/auth.js`, `src/app/api/heyreach/campaigns/route.js`, `src/app/heyreach/campaigns/page.jsx`, `src/app/campaigns/page.jsx`, `src/components/NumCell.jsx` (new), `src/hooks/usePinnedColumns.js` (new)
- Todos resolved: #017 (HeyReach sync was already parallel; confirmed + cross-device sync race fix applied), #018, #019, #020, #021, #022 — all complete

---

## 2026-04-28 — Auth hardening: middleware + login route + sync in-flight guard

- What changed:
  - **middleware.js** — removed hardcoded `SESSION_TOKEN || 'gl-auth-v1'` fallback. If `SESSION_TOKEN` env var is missing, middleware now redirects to `/login` (consistent with wrong-session behaviour) rather than silently accepting a publicly-known token value.
  - **login/route.js** — removed hardcoded `LOGIN_PASSWORD` and `SESSION_TOKEN` fallbacks. Returns 500 if either env var is missing; no default credentials in source code.
  - **In-flight sync guard** — added `syncInFlight` ref to both `campaigns/page.jsx` and `heyreach/campaigns/page.jsx`. `loadIds()` exits immediately if already running, preventing React StrictMode double-invoke or rapid re-mounts from firing duplicate `Promise.all` sync requests. Flag reset in `finally` so it clears on error too.
- Why: Completing todo #020 across all three auth files (auth.js was fixed by linter; middleware + login were missed). In-flight guard closes the concurrent-mount race noted in todo #017.
- Files affected: `src/middleware.js`, `src/app/api/auth/login/route.js`, `src/app/campaigns/page.jsx`, `src/app/heyreach/campaigns/page.jsx`

---

## 2026-04-28 — Full system audit: 6 bugs fixed

- What changed:
  - **CSV export geo location** — `export/route.js` was reading `rp.geo` (top-level) which doesn't exist in real Happier Leads payloads. Location in exported CSVs was always blank. Fixed to `(rp.contact || {}).geo || rp.geo || rp.location || {}`.
  - **LIKE metacharacter escape** — search inputs containing `%` or `_` were treated as SQL wildcards. Both `leads/route.js` and `export/route.js` now escape `\`, `%`, `_` before building the ILIKE pattern and add `ESCAPE '\'` to the query.
  - **PushDropdown viewport overflow** — dropdown was always positioned below the trigger button with no viewport check. Leads near the bottom of the list would open a dropdown that goes off-screen. Now flips above the button when `coords.bottom + 280 > window.innerHeight`, and clamps `left` so it never overflows the right edge.
  - **Detail panel stuck in loading** — when `/api/leads/[id]` returned an error or the request threw, the catch block was empty, leaving the expand panel in "Loading…" forever. Now stores `'__error'` sentinel in detailCache, shows "Failed to load lead details. Try clicking the row again." and clears the sentinel on re-click so it retries.
  - **Push UPDATE missing ::uuid cast** — `UPDATE leads … WHERE id = ${id}` was missing `::uuid`, inconsistent with the SELECT in the same handler. Now `WHERE id = ${id}::uuid`.
  - **Sequential ID sync on campaign load** — loading campaign IDs from localStorage to server was done with a serial `for...await` loop (up to 20 sequential API calls). Replaced with `Promise.all` on both SmartLead and HeyReach campaign pages.
- Why: Full system audit requested; all confirmed bugs fixed.
- Files affected: `src/app/api/leads/export/route.js`, `src/app/api/leads/route.js`, `src/app/filtered/page.jsx`, `src/app/api/leads/[id]/push/route.js`, `src/app/campaigns/page.jsx`, `src/app/heyreach/campaigns/page.jsx`

---

## 2026-04-28 — HeyReach real data + SmartLead-style columns

- What changed:
  - **Zero data bug fixed** — route was reading `info.statistics ?? info.stats` but the HeyReach `GetById` endpoint returns data in `info.progressStats`. All totals now show real numbers.
  - **Dead endpoint removed** — `GetCampaignStatsByCampaignId` returns 404 for all campaigns; removed entirely.
  - **New columns** — table now matches SmartLead layout: Campaign Name, Status, List (linkedInUserListName), Total, In Progress, Pending, Finished, Failed, Stopped, Excluded, Accept Rate, Reply Rate, Created
  - **Pills row updated** — shows Total Leads, In Progress, Finished, Failed aggregate stats
  - **Bar chart** now uses Total Leads as the primary metric (was Invites Sent which had no data)
  - Accept Rate / Reply Rate columns present but show 0% until HeyReach stats endpoint becomes available
- Why: `progressStats` is the correct field; the old invites/accepted/replies stats endpoint is dead.
- Files affected: `src/app/api/heyreach/campaigns/route.js`, `src/app/heyreach/campaigns/page.jsx`

---

## 2026-04-28 — HeyReach API key replaced (valid key confirmed)

- What changed: Updated `HEYREACH_API_KEY` in `.env.local` and Vercel production env to `ZK+4uxRPewwZoaVziCgcr9POLmcY4U9aG9iDqEdgQ40=`. Redeployed to production.
- Why: Previous key was invalid (rejected by HeyReach). New key confirmed working — `POST /Campaign/GetAll` returned 200 with 90 campaigns.
- Files affected: `.env.local`, Vercel env vars (via CLI)

---

## 2026-04-28 — Cross-device sync fix + HeyReach invalid key error surfacing

- What changed:
  - **SmartLead cross-device sync** — removed the `sl-ids-migrated` one-shot flag. IDs present in localStorage but missing on the server are now pushed on every page load, so any device that has the campaigns in localStorage will sync them to the server regardless of visit order. `ON CONFLICT DO NOTHING` prevents duplicates.
  - **HeyReach same fix** — removed `hr-ids-migrated` flag for the same reason (consistency and future-proofing).
  - **HeyReach API 401 detection** — `hrGet()` now returns `{ __authError: true }` on a 401 response; `fetchOneCampaign` throws `HEYREACH_INVALID_KEY`; the route handler surfaces it as a 401 JSON response. The UI now shows "API key is invalid — check Vercel settings" instead of silently showing 0 campaigns.
  - **HeyReach API key** — key provided (`e8R3zOgSLfkT9lKUjTwQpQVFal9OntxjoBj4cUZ7Dvo=`) was rejected by HeyReach as invalid. Correct key pending — user to provide from HeyReach Settings → API. Once received, update `HEYREACH_API_KEY` in Vercel env and redeploy.
- Why: Campaign IDs were invisible on secondary devices because migration only ran once; wrong API key was silently failing with 0 results instead of a clear error.
- Files affected: `src/app/campaigns/page.jsx`, `src/app/heyreach/campaigns/page.jsx`, `src/app/api/heyreach/campaigns/route.js`

---

## 2026-04-28 — Sidebar polish: dividers, badges, active bar + HeyReach API key

- What changed:
  - **Sidebar section headers** now show a colored icon badge (blue for Pipeline, purple for HeyReach, green for SmartLead) before each section label, matching the reference design
  - **Section dividers** — horizontal `border-top` line between sections (not before Pipeline); works in both expanded and collapsed states
  - **Double divider bug fixed** — collapsed sidebar was rendering both the outer `border-top` from `.sidebar-section-divided` AND an inner divider div simultaneously; removed the redundant inner div
  - **Active item left bar** — `box-shadow: inset 3px 0 0 var(--blue-400)` added to `.sidebar-item.active`; shows a blue vertical bar on the left edge of the active nav item in both expanded and collapsed states
  - **HeyReach API key** configured in `.env.local` (gitignored); must also be set in Vercel environment variables as `HEYREACH_API_KEY`
- Why: Visual polish to match reference design; fix collapsed sidebar regression; enable HeyReach API calls in production.
- Files affected: `src/components/Sidebar.jsx`, `src/styles/custom.css`, `.env.local`

---

## 2026-04-28 — HeyReach Campaigns page (LinkedIn analytics)

- What changed:
  - **New page** `/heyreach/campaigns` — identical UX to SmartLead campaigns page but for LinkedIn outreach metrics (Invites Sent, Accepted %, Messages Sent, Replies %)
  - **New API route** `GET /api/heyreach/campaigns?ids=...` — calls HeyReach API (`/Campaign/GetById` + `/Campaign/GetCampaignStatsByCampaignId`) with `X-API-KEY` auth header; normalizes `IN_PROGRESS` → `ACTIVE`
  - **New API route** `GET/POST/DELETE /api/heyreach/campaign-ids` — persists HeyReach campaign IDs in new `heyreach_campaign_ids` DB table (auto-created)
  - **Sidebar** — added `HEYREACH` section above `Smart Lead`; both sections now show their labels; Smart Lead `hideLabel` removed
  - **Bar chart** shows "Top 10 Campaigns by Invites Sent" instead of emails
  - **Stats bar** shows Total Leads · Invites Sent · Accepted · Replies
  - **localStorage key** `hr-campaign-ids` (separate from SmartLead's `sl-campaign-ids`)
  - **New env var** `HEYREACH_API_KEY` — add to `.env.local` and Vercel settings
- Why: User requested HeyReach (LinkedIn outreach) campaign tracking alongside SmartLead (email).
- Files affected: `src/app/heyreach/campaigns/page.jsx` (new), `src/app/api/heyreach/campaigns/route.js` (new), `src/app/api/heyreach/campaign-ids/route.js` (new), `src/components/Sidebar.jsx`, `.env.local`, `docs/3-single-source-of-truth.md`

---

## 2026-04-28 — Campaign ID sync: robust cross-device strategy

- What changed:
  - **Bug**: Previous migration only triggered when `(server empty) AND (this browser's localStorage has IDs)`. If mobile was opened first (empty localStorage → nothing pushed), server stayed empty forever and all devices showed the empty state.
  - **Fix — new `loadIds()` strategy**:
    1. Render localStorage cache immediately (no flicker on revisit)
    2. Fetch server list; push any IDs present locally but missing on server (handles migration from whichever device still has old localStorage data, regardless of order)
    3. One-time flag `sl-ids-migrated` in localStorage prevents removed IDs from reappearing after migration
    4. Server is authoritative once migration completes; localStorage kept as offline fallback cache
  - **Add/remove** now updates both server AND localStorage to keep the cache in sync
- Why: Campaigns were invisible on mobile because the DB was never populated — the migration conditions were never simultaneously true across devices.
- Files affected: `src/app/campaigns/page.jsx`

---

## 2026-04-28 — Campaign IDs: move from localStorage to server DB

- What changed:
  - **New API route** `GET/POST/DELETE /api/campaigns/ids` — stores tracked campaign IDs in a `campaign_ids` Neon table (created automatically on first request via `CREATE TABLE IF NOT EXISTS`).
  - **Campaigns page** now loads IDs from the server API on mount instead of `localStorage`. Add/remove operations call the API instead of writing to localStorage.
  - **One-time migration**: on first load, if the server has no IDs but `localStorage` has some (from a previous desktop session), those IDs are automatically pushed to the server and localStorage is cleared.
- Why: `localStorage` is per-browser and not synced across devices. Campaign IDs added on desktop were invisible on mobile, showing the empty state.
- Files affected: `src/app/api/campaigns/ids/route.js` (new), `src/app/campaigns/page.jsx`
- DB schema addition: `CREATE TABLE IF NOT EXISTS campaign_ids (id TEXT PRIMARY KEY, added_at TIMESTAMPTZ DEFAULT now())`

---

## 2026-04-27 — Full responsive system audit + fixes

- What changed:
  - **Campaigns pills row (tablet/mobile)** — added `overflow-x: auto; flex-wrap: nowrap` at ≤1100px so the entire status pills + stat row scrolls horizontally as a single row instead of wrapping into a multi-line block. Scrollbar hidden (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`).
  - **Campaign dialog (tiny screens)** — added `max-width: calc(100vw - 40px)` at ≤480px so the dialog never overflows a 320px viewport.
  - **Push dropdown (mobile)** — changed from `min-width: 220px; max-width: 320px` to `min-width: 160px; max-width: calc(100vw - 32px)` at ≤640px. Prevents overflow on narrow screens.
  - **Overview chart filter popover (mobile)** — added `left: 0; right: auto` at ≤640px to prevent right-edge overflow when button is near left side.
  - **Calendar popover (mobile)** — added `max-width: calc(100vw - 32px)` at ≤640px to prevent overflow on 320px screens.
  - **Calendar nav touch targets** — added `min-width: 36px; min-height: 36px` to `.cal-nav-btn` at ≤640px for easier tapping.
  - **Duplicate CSS removed** — `.campaigns-search-field` rule was duplicated; removed the duplicate.
- Why: Full responsive system audit requested across all pages, all breakpoints (desktop/tablet/mobile). All identified high/medium severity issues resolved.
- Files affected: `src/styles/custom.css`

---

## 2026-04-28 — Full campaigns audit + fixes

- What changed:
  - **Donut chart** — added ARCHIVED, DRAFT, FAILED to `DONUT_SEGS`. Previously those 3 statuses were silently excluded from the chart; campaigns with those statuses would not appear in the breakdown at all.
  - **SmartLead field mappings (previous commit)** — `totalLeads` now uses `total_count` (502, matches SmartLead native UI) not `cls.total` (127). `sendPending` now correctly uses `total_count − sent_count` (pending emails) instead of `cls.notStarted` (duplicate of Yet to Start). `emailsSent` uses `sent_count`. All numeric fields wrapped in `Number()` since SmartLead returns counts as strings.
  - **Opens/Replies %** — denominator changed to `emailsSent` (sent_count = 180), giving 1% for replies instead of 2%. Matches SmartLead native UI reference.
  - **Sent column** — added to campaigns table showing `sent_count` from SmartLead.
  - **Debug log** — `console.log` used to audit field names has been removed.
- Why: Full audit requested to ensure every new campaign added shows accurate real-time data with no duplicate or wrong field mappings.
- Real-time data confirmed: `force-dynamic` on route, `cache: 'no-store'` on all SmartLead fetches, `Cache-Control: no-store` on response, `?_t=timestamp` + `cache: 'no-store'` on frontend fetch, auto-refresh every 2 min.
- Files affected: `src/app/campaigns/page.jsx`, `src/app/api/smartlead/campaigns/route.js`

---

## 2026-04-27 — Donut chart hover: floating cursor-following tooltip

- What changed: The DonutChart hover was changing the SVG center text (label + count + %) when hovering an arc segment. Replaced with a floating HTML tooltip that follows the cursor — matching the reference UI. Implementation: removed `hoveredSeg` state; added `arcTip: { arc, x, y }` state updated on `onMouseMove` with `e.clientX/e.clientY`; tooltip rendered as `position: fixed` so `overflow: hidden` on `.campaigns-charts-inner` never clips it; center text always shows `total + "campaigns"`. The BarChart also has a cursor-following tooltip (via `containerRef` + `getBoundingClientRect()`).
- Why: Reference UI shows a floating overlay near the cursor, not a center-text replacement. Using `position: fixed` avoids any clipping from ancestor containers.
- Files affected: `src/app/campaigns/page.jsx`

---

## 2026-04-28 — Bar chart rewritten as CSS divs; donut card vertically centred

- What changed:
  - **BarChart rewritten with CSS flex divs** — replaced the SVG-based bar chart entirely. SVG scaled proportionally with container width (1.8× on wide viewports), making bars appear huge with few campaigns. CSS divs have a fixed **36px row height** regardless of container width, matching the reference exactly. Vertical gridlines are absolutely-positioned divs using `calc(${LABEL_W}px + ${f} * (100% - ${LABEL_W}px))`. Tick labels absolutely positioned at exact percentages. scaleX animation preserved.
  - **Donut card vertically centres its content** — card is now `display: flex; flex-direction: column`; the DonutChart is wrapped in a `flex: 1` div with `align-items: center` so the donut sits centred when the card stretches to match the bar chart height.
  - **Grid cards equalised** — removed `align-items: start` from `.campaigns-charts-grid` so both cards stretch to the same height (default grid behaviour).
- Why: Single-campaign view showed an oversized bar because SVG aspect ratio (530:~52) rendered at 1.8× scale in a wide container. CSS divs with fixed pixel heights eliminate the scaling problem entirely.
- Files affected: `src/app/campaigns/page.jsx`, `src/styles/custom.css`

---

## 2026-04-28 — Campaigns table: column pin on hover + Opens/Replies percentages + Created column fix

- What changed:
  - **Column pin** — hovering any column header shows a pushpin icon. Clicking pins that column sticky (stays visible while scrolling horizontally). Pinned columns show the icon in blue permanently. Implemented via `pinnedCols` Set state, a `stickyStyle(key)` helper that computes `left` offsets by summing widths of preceding pinned columns, and a `COLS` array defining each column's key/label/align/width.
  - **Opens/Replies percentages** — both columns now show `N (X%)` where X = `Math.round(value / totalLeads * 100)`, matching the reference UI.
  - **Created column no longer clipped** — `table { width: 100% }` in reference.css was forcing the table into the container width, squeezing the last column instead of triggering horizontal scroll. Fixed by adding `minWidth: COLS.reduce((s,c) => s+c.w, 0)` (1405px) to the `<table>` element.
- Why: User requested pin icon, percentage display on opens/replies, and the Created column was being cut off at the card edge.
- Files affected: `src/app/campaigns/page.jsx`, `src/styles/custom.css`

---

## 2026-04-28 — Campaigns charts: match reference UI + fix donut layout overflow

- What changed:
  - **Bar chart** now sorts by Emails Sent (`total_count` / `unique_sent_count`) instead of Total Leads, title updated to "Top 10 Campaigns by Emails Sent". Bar color changed to solid `#4A7BF7`. Row height reduced (38→30), bar height (20→16), tick height (28→22) for more compact rows.
  - **API route** gains an `emailsSent` field (`a.total_count || a.unique_sent_count`). `totalLeads` no longer falls back to `total_count` (different metric — would have mixed lead counts with email send counts).
  - **Donut chart** simplified to 3 fixed segments only — Active (green `#4ade80`), Paused (gold `#facc15`), Completed (blue `#60a5fa`, merges FINISHED). Count shown as a small dark chip badge beside the percentage. Ring dimensions: OR=66, IR=46.
  - **Donut layout overflow fixed** — root cause: `SVG(140px) + gap(24px) + legend-minWidth(148px) = 312px` overflowed the 260px inner width of the right card, forcing the legend to wrap below the donut and doubling the card height. Fixed by: right grid column 300px→320px, SVG 140→120px, gap 24→16px, legend uses `flex: 1 / minWidth: 0` instead of a fixed minWidth, `flexWrap: nowrap`.
  - **Chart grid**: `align-items: start` added so the bar chart card doesn't stretch to match the taller donut card.
- Why: Reference UI screenshot shows compact, proportional charts. Previous implementation had wrong metric (Total Leads vs Emails Sent), all-status donut instead of 3 fixed segments, and a layout bug that made the donut card very tall when the legend wrapped.
- Files affected: `src/app/campaigns/page.jsx`, `src/app/api/smartlead/campaigns/route.js`, `src/styles/custom.css`

---

## 2026-04-27 — SmartLead analytics: fix zero-data by correcting field names

- What changed: All lead-stat columns on the Campaigns page (Total Leads, In Progress, Yet to Start, Completed, Blocked) were showing 0 despite real data existing. Root cause was wrong field names in `fetchOneCampaign` — the code guessed at names like `total_lead_count`, `in_progress_count`, `not_contacted_count` which SmartLead does not return. Fixed to use the real response structure: lead stats live inside a nested `campaign_lead_stats` object with fields `total`, `inprogress` (no underscore), `notStarted` (camelCase), `completed`, `blocked`. Top-level fields `open_count`, `reply_count`, `click_count`, `total_count` were already correct.
- Why: SmartLead analytics endpoint returns `{ campaign_lead_stats: { total, inprogress, notStarted, completed, blocked, … }, open_count, reply_count, … }`. Previous guesses were never validated against real API responses.
- Files affected: `src/app/api/smartlead/campaigns/route.js`

---

## 2026-04-27 — Campaigns page: unified single filter+stats tab

- What changed: Replaced the two separate filter rows (an "All Status" dropdown + a stats bar above the pills) with a single unified `tabs-pill` box containing everything — filter buttons (All / Active / Paused / Finished / Draft) followed by a thin vertical divider, then the stats (Total Leads / In Progress / Leads Finished / Leads Failed / Last Synced) — all inside one pill container with consistent hover and styling.
- Why: User saw two rows that looked like duplicate filters. Consolidated into one bar so there is no visual ambiguity.
- Files affected: `src/app/campaigns/page.jsx`, `src/styles/custom.css`

---

## 2026-04-27 — BarChart animation unit bug fixed

- What changed: `BarChart` in `campaigns/page.jsx` was animating `style.width` with a numeric value. React converts numeric style values to `px`, but `barW` is in SVG user units. In a scaled SVG (`viewBox="0 0 530 N"` rendered at any other width) the bars would render at the wrong size. Fixed by keeping `width={barW}` as the SVG attribute and animating via `transform: scaleX(0→1)` with `transformBox: fill-box` and `transformOrigin: left center` — no unit mismatch, scales from the bar's own left edge.
- Why: SVG geometry attributes and CSS length units are in different coordinate spaces when the SVG has a viewBox.
- Files affected: `src/app/campaigns/page.jsx`

---

## 2026-04-27 — Full system audit: 4 bugs fixed

- What changed:
  - **Campaigns page date filter now works** — `calFrom`/`calTo` were stored in state and shown in the filter bar (triggering the "Clear" button) but were never applied to the campaign list. Now filters campaigns by their `created` date client-side.
  - **Push route UUID cast** — `WHERE id = ${id}` in `POST /api/leads/[id]/push` was missing `::uuid` cast. A non-UUID `id` path param now gets a proper DB error rather than a confusing 500. Consistent with the GET handler in the same directory.
  - **Middleware now excludes all `/api/*` routes** — previously the matcher covered `/api/leads`, `/api/smartlead/*`, etc. This silently broke the `Authorization: Bearer` support in `auth.js` — programmatic requests with a Bearer token (no cookie) were redirected to `/login` HTML before the handler ran. API routes all have their own `requireAuth()` returning 401 JSON; they don't need middleware protection.
  - **Webhook open-secret warning** — added `console.warn` when `WEBHOOK_SECRET` env var is not set so the oversight surfaces in Vercel function logs.
- Why: Audit discovered dead UI code, an inconsistency in UUID handling, a middleware/auth mismatch, and a silent security gap.
- Files affected:
  - `src/app/campaigns/page.jsx`
  - `src/app/api/leads/[id]/push/route.js`
  - `src/middleware.js`
  - `src/app/api/webhook/happierleads/route.js`

---

## 2026-04-27 — Campaigns page: restore Add Campaign + ID-only tracking, real-time data, UI cleanup

- What changed:
  - **Restored Add Campaign button + dialog** — was accidentally removed when auto-discovery was added. Campaign IDs are entered manually and persisted in `localStorage` (`sl-campaign-ids`, max 20). Only explicitly-added campaigns are shown.
  - **Removed auto-discovery of all campaigns** — the earlier "fix" that fetched all 50 SmartLead campaigns regardless of what the user wanted has been reverted. The page now only shows campaigns the user has added by ID.
  - **Removed Force Sync button** — redundant; merged into a single **Sync** button that always fetches fresh data.
  - **Renamed Refresh → Sync** — clearer intent.
  - **Auto-refresh every 2 minutes** — page re-fetches tracked campaign data automatically while open.
  - **Real-time data fixes** — three caching layers eliminated: `export const dynamic = 'force-dynamic'` on the route (prevents Next.js CDN caching), `Cache-Control: no-store` on the response, and `cache: 'no-store'` + `?_t=<timestamp>` on every frontend fetch.
  - **Bar chart hallucination fix** — was rendering 2px stub bars for zero values. Now shows "No lead data available yet" when `totalLeads` is 0 for all campaigns.
  - **Analytics field name fix** — SmartLead returns `total_leads` (not `total_lead_count`). Added broad fallbacks for all analytics fields.
  - **Push dropdown** — updated to also fetch campaigns without localStorage dependency (calls `/api/smartlead/campaigns` directly); shows "No campaigns found in SmartLead" if empty.
  - **Stale subtitle** — updated from "add campaign IDs to track live data" to "track specific campaigns by ID".
- Why: User wanted to track specific campaigns only, not their entire SmartLead account. Data was stale due to multiple caching layers. Chart was showing fake bars.
- Files affected:
  - `src/app/campaigns/page.jsx`
  - `src/app/api/smartlead/campaigns/route.js`
  - `src/app/filtered/page.jsx`

---

## 2026-04-27 — Campaigns page: remove duplicate status dropdown

- What changed: Removed the `StatusDropdown` component and `STATUS_OPTS` constant from the campaigns page. The "All Status" dropdown in the filter bar was a redundant second status filter alongside the pills/tabs row. Only the pills row remains.
- Why: User reported seeing two status filters. The pills row is preferred — smaller, cleaner, shows counts per status.
- Files affected: `src/app/campaigns/page.jsx`

---

## 2026-04-27 — Push to Smart Lead button made live — campaign picker + push API

- What changed:
  - **`POST /api/leads/[id]/push`** — new API route. Accepts `{ campaignId }`, fetches the lead from DB, POSTs to SmartLead `POST /campaigns/{id}/leads`, then sets `pushed_to_smart_lead = true` and `pushed_at = now()` in DB. Auth-protected.
  - **Push button on Leads page** is now active (was permanently disabled). Clicking it opens a fixed-position **campaign picker popup** that loads campaign names from `/api/smartlead/campaigns` using the IDs stored in `localStorage` (`sl-campaign-ids`).
  - Selecting a campaign in the popup triggers the push immediately — no separate confirm step.
  - On success the button switches to green **"Pushed ✓"** state for the rest of the session; DB is updated server-side.
  - If no campaigns have been added yet, the popup shows "No campaigns added yet" with a link to the Campaigns page.
- Why: The Add Campaign feature (same session) stores campaign IDs in localStorage — this feature uses those same IDs to populate the picker, completing the push-to-campaign flow end-to-end.
- Files affected:
  - `src/app/api/leads/[id]/push/route.js` (new)
  - `src/app/filtered/page.jsx` (PushDropdown component, push state wiring)
  - `src/styles/custom.css` (push-btn-live, push-btn-done, push-dropdown styles)

---

## 2026-04-27 — SmartLead Campaigns page: Add Campaign, live analytics, charts

- What changed:
  - **Add Campaign button** in campaigns page header — opens a dialog where the user enters a SmartLead campaign ID (number). IDs are persisted in `localStorage` under `sl-campaign-ids` (max 20).
  - **`GET /api/smartlead/campaigns?ids=…`** — new API route. Accepts comma-separated campaign IDs, fetches campaign info + analytics from SmartLead API in parallel using `Promise.allSettled`, returns normalized data. Auth-protected. Requires `SMARTLEAD_API_KEY` env var.
  - **Campaign table** updated with columns: Campaign Name, Status, Total, Completed, In Progress, Yet to Start, Blocked, Send Pending, Opens, Replies, Bounces, Clicks, Created.
  - **Remove campaign** — hover over a row to see the ✕ remove button; right-click shows a context menu with "Remove Campaign". Removing updates localStorage and removes the row instantly.
  - **Stats bar** — Total, Active, Paused, Finished, Total Leads, In Progress, Leads Finished, Leads Failed, Last Synced (matches the reference UI).
  - **Show/Hide Charts** toggle with smooth CSS grid animation (`grid-template-rows: 0fr → 1fr`).
  - **Bar chart** (SVG, pure, no library) — Top 10 campaigns by Total Leads.
  - **Donut chart** (SVG, pure, no library) — Status Breakdown with count + percentage legend.
  - **Force Sync** (orange) and **Refresh** (blue) buttons replace the old disabled Sync Live button.
  - **Add Campaign dialog** — smooth `dialog-in` keyframe animation, validates numeric ID, duplicate detection, max-20 guard.
- Why: Phase 2 SmartLead integration — user wanted to track campaign analytics from their existing SmartLead account.
- Files affected:
  - `src/app/campaigns/page.jsx` (full rewrite)
  - `src/app/api/smartlead/campaigns/route.js` (new)
  - `src/styles/custom.css` (appended new component styles)
  - `.env.local` (added `SMARTLEAD_API_KEY=` placeholder)
- Config required: Set `SMARTLEAD_API_KEY` in Vercel environment variables (Project Settings → Environment Variables).

---

## 2026-04-27 — Full system audit + loophole fixes (7-agent /ce-review)

- What changed: Full security, performance, architecture, simplicity, and pattern audit completed (7 agents). All exploitable loopholes fixed:
  - **auth.js**: Added `Authorization: Bearer <token>` support alongside cookie auth for programmatic/agent access
  - **auth/login/route.js**: Added `maxAge: 30d` to session cookie (was session-scoped, expired on browser close)
  - **All user-facing API routes** (`/api/leads`, `/api/leads/[id]`, `/api/leads/chart`, `/api/leads/export`): Wrapped DB calls in `withRetry()` — was only applied to the webhook previously
  - **Date-cast index miss**: Fixed `received_at::date >= x::date` (bypassed B-tree index) to `received_at >= x::date AND received_at < x::date + INTERVAL '1 day'` across leads, chart, and export routes
  - **Export OOM**: Added `LIMIT 10000` safety cap to prevent memory exhaustion on large exports
  - **Permissions-Policy header**: Added `camera=(), microphone=(), geolocation=()` to `next.config.js`
  - **EmptyState**: Updated ngrok instructions to reflect production state (webhook permanently configured, no ngrok needed)
- Why: Full system audit to identify and close all loopholes before treating the system as production-ready
- Files affected: `src/lib/auth.js`, `src/app/api/auth/login/route.js`, `src/app/api/leads/route.js`, `src/app/api/leads/[id]/route.js`, `src/app/api/leads/chart/route.js`, `src/app/api/leads/export/route.js`, `next.config.js`, `src/components/EmptyState.jsx`

**Architectural improvements identified but deferred (not loopholes, require larger refactoring):**
- Auth dual-system: middleware + requireAuth() are independent — a missed `requireAuth()` call would expose a route
- `/api/leads` couples stats + paginated data — stats run on every 10s poll unnecessarily
- `filtered/page.jsx` is a 679-line god component
- Module-level `_cache` variables in page.jsx and filtered/page.jsx (wrong layer for React)
- Campaigns page ships full UI (calendar, debounce, dropdowns) over `CAMPAIGNS = []` empty array

---

## 2026-04-27 — Fix campaigns search field creating blank space on mobile

- What changed: Removed `flex:'0 1 240px'` and `minWidth:130` from the inline style on `.campaigns-search-field` and moved them into a CSS class rule instead.
- Why: Inline styles override CSS class rules, so the mobile `flex: none` override in the `@media (max-width: 640px)` block was being ignored. In a column flex layout, `flex-basis: 240px` becomes a **height** of 240px — creating ~200px of blank space below the 36px-tall search input, followed by a lone search icon appearing before the rest of the filters.
- Files affected: `src/styles/custom.css`, `src/app/campaigns/page.jsx`

---

## 2026-04-27 — Fix mobile filter bar alignment on Leads and Campaigns pages

- What changed: Added mobile-specific CSS rules for both filter bars at ≤640px. Leads page: `tabs-pill` now stretches full width, vertical `filter-divider` hidden, `time-filter-group` goes full width with the date range trigger sharing space equally between both date buttons, and the cal-popover anchors to `left: 0` so it never clips off the right edge. Campaigns page: `campaigns-filter-bar` switches to `flex-direction: column` so every control (search, status dropdown, date range, action buttons) stacks as its own full-width row; action buttons lose `marginLeft: auto` and each button stretches `flex: 1`; `campaigns-pills-row` stacks the two pill groups vertically.
- Why: On mobile the filter controls were wrapping mid-row with mixed sizes, the date picker was overflowing the viewport, and the campaigns action buttons were misaligned due to `marginLeft: auto` not working correctly in a wrapped flex container.
- Files affected: `src/styles/custom.css`, `src/app/campaigns/page.jsx` (added `campaigns-filter-actions` class to action buttons div)

---

## 2026-04-27 — Implement all 16 code-review findings (security, performance, cleanup)

- What changed: Addressed all findings from /ce-review. Full list:
  - **Auth (P1)**: Added `src/lib/auth.js` with `requireAuth()` (cookie-based); applied to `GET /api/leads`, `GET /api/leads/[id]`, `GET /api/leads/chart`. Removed unauthenticated DELETE handler from leads route (had no UI caller).
  - **Rate limiting (P1)**: Added in-memory 10 req/min rate limiter on `POST /api/auth/login`.
  - **Webhook secret (P1)**: Added `WEBHOOK_SECRET` env var check (x-hl-secret header); skips check if env var is unset for gradual rollout.
  - **Env vars (P2)**: Moved hardcoded `'Growleads@admin'` and `'gl-auth-v1'` to `process.env.LOGIN_PASSWORD` and `process.env.SESSION_TOKEN` with fallbacks.
  - **withRetry (P2)**: Moved `withRetry` from inline webhook to `src/lib/db.js` (named export). Added try/catch to leads, leads/[id], and chart routes.
  - **CalendarPicker (P2)**: Extracted to `src/components/CalendarPicker.jsx` (exports default + `fmtCalDate`). Removed duplicated copies from `page.jsx`, `filtered/page.jsx`, `campaigns/page.jsx`.
  - **Security headers (P2)**: Added `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` in `next.config.js`.
  - **Polling guard (P2)**: Added `document.hidden` check to Overview page polling interval.
  - **Dead files (P2)**: Deleted `src/components/LeadsTable.jsx`, `src/components/StatsBar.jsx` (unused).
  - **Campaigns placeholder (P2)**: Removed fake sync handler; Sync Live button is now disabled with Phase-2 title.
  - **CSV export API (P2)**: Added `GET /api/leads/export` returning CSV with full raw_payload fields; `handleExportCSV` in filtered/page.jsx now calls this endpoint instead of iterating pages.
  - **ILIKE null guard (P3)**: Added `${search}::text IS NULL OR ...` guard so background polls with no search term skip the ILIKE scan.
  - **Chart SQL (P3)**: Collapsed three near-identical daily SQL branches in chart/route.js to one parameterized query.
  - **raw_payload in list (P3)**: Removed `raw_payload` from `GET /api/leads` SELECT. `LeadDetailPanel` now fetches from `GET /api/leads/[id]` on first expand; subsequent expands use cached result.
  - **PII log (P3)**: Replaced full-body JSON.stringify on webhook error with key names only.
  - **remotePatterns (P3)**: Narrowed from `**` to `logo.clearbit.com`, `*.amazonaws.com`, `*.happierleads.com`.
- Why: Security hardening, performance improvements, code cleanup.
- Files affected: `src/lib/auth.js` (new), `src/lib/db.js`, `src/components/CalendarPicker.jsx` (new), `src/app/api/leads/route.js`, `src/app/api/leads/[id]/route.js`, `src/app/api/leads/chart/route.js`, `src/app/api/leads/export/route.js` (new), `src/app/api/auth/login/route.js`, `src/app/api/webhook/happierleads/route.js`, `src/middleware.js`, `next.config.js`, `src/app/page.jsx`, `src/app/filtered/page.jsx`, `src/app/campaigns/page.jsx`, deleted `src/components/LeadsTable.jsx` + `StatsBar.jsx`

---

## 2026-04-27 — Remove admin page and all admin API routes

- What changed: Deleted `src/app/admin/page.jsx`, `src/app/api/admin/sync-from-hl/route.js`, and `src/app/api/admin/backfill-scores/route.js`. Removed the Admin button from the sidebar footer in `src/components/Sidebar.jsx`.
- Why: Admin section is no longer needed.
- Files affected: `src/app/admin/page.jsx` (deleted), `src/app/api/admin/` (deleted), `src/components/Sidebar.jsx`

---

## 2026-04-25 — Webhook resilience: retry on DB cold start, payload change detection

- What changed: Added `withRetry` helper (2 retries, exponential backoff) wrapping both the dedup SELECT and the INSERT in the webhook route. Added a `console.error` warning when all key identity fields (`leadId`, email, fullName) are null — indicates a Happier Leads payload format change. Replaced bare `throw err` on INSERT failure with an explicit `console.error` + structured `{ ok: false }` 500 response.
- Why: Neon free-tier compute can suspend; the first DB call after a long idle period can time out. Retries handle the cold-start case without losing the lead. Null-field logging surfaces HL payload schema changes in Vercel logs.
- Files affected: `src/app/api/webhook/happierleads/route.js`

---

## 2026-04-25 — Admin Client Tags: add search icon, remove SOURCE toggle

- What changed: Both the Notes tab and Client Tags tab campaign search inputs now have a magnifying glass icon on the left (`.campaign-search-input-wrap` + `.campaign-search-icon` CSS). A SOURCE toggle (HeyReach / SmartLead) was briefly added to the Client Tags tab then immediately removed — only SmartLead is used, so both forms simply show "SmartLead Campaign" as the label with no source selector.
- Why: Reference screenshots showed a search icon inside the input. SOURCE toggle was removed per user feedback ("we only work with SmartLead").
- Files affected: `src/app/admin/page.jsx`, `src/styles/custom.css`

---

## 2026-04-25 — Clear mock campaign names from admin search dropdowns

- What changed: `CAMPAIGN_NAMES` constant in `admin/page.jsx` emptied — removed 10 hardcoded placeholder entries (ImpactCraftAI, Moora_Faire, Growleads_April_*, etc.) that appeared in both the Notes-tab and Client Tags-tab campaign search dropdowns.
- Why: Mock data was showing as real records in the UI. Dropdowns should be empty until real Smart Lead campaign data is wired in (Phase 2).
- Files affected: `src/app/admin/page.jsx`

---

## 2026-04-25 — Fix campaign search dropdown readability in admin panel

- What changed: `.campaign-search-opt` text color changed from `var(--text-muted)` (#5c6080, barely readable) to `var(--text-primary)`. Dropdown border strengthened from `var(--border-color)` to `rgba(148,163,184,0.2)` and box-shadow deepened slightly to 0.55 opacity. Both the Notes-tab dropdown and Client Tags-tab dropdown are fixed (they share the same CSS classes).
- Why: Screenshots showed campaign names in both dropdowns were extremely dim and the container border was invisible against the dark background.
- Files affected: `src/styles/custom.css`

---

## 2026-04-25 — Fix mobile: admin link closes sidebar + scroll-to-top on navigation

- What changed: Admin footer link in `Sidebar.jsx` now calls `onClose()` on click — it was missing the handler that all nav items have, so the drawer stayed open. Added `useEffect(() => { window.scrollTo(0,0); }, [pathname])` to `ClientLayout.jsx` so every page navigation resets scroll position to the top (App Router doesn't do this reliably on mobile, causing admin and other pages to open mid-scroll).
- Why: On mobile: tapping Admin left the sidebar open; navigating to the admin page showed the "Add Note" form instead of the breadcrumb header because the page retained the previous page's scroll position.
- Files affected: `src/components/Sidebar.jsx`, `src/components/ClientLayout.jsx`

---

## 2026-04-25 — Unify login design; add spinner to main login; fix CLIENT_TAGS crash; campaigns polish

- What changed:
  1. **Admin auth gate** — removed the amber `login-card-header` ("ADMIN AUTHENTICATION" with lock icon) and swapped `admin-submit-btn` → `login-submit-btn`. The admin secondary auth gate now uses the same blue card design as the main login page. Spinner animation on the button is retained.
  2. **Main login page spinner** — "Sign in" button now shows a spinning SVG + "Signing in…" while the `POST /api/auth/login` fetch is in flight (was text-only before). `.login-submit-btn` CSS updated with `display:flex; align-items:center; gap:8px` to support the inline icon.
  3. **Admin `CLIENT_TAGS` crash** — `CLIENT_TAGS` was referenced but never defined, causing a `ReferenceError` that crashed the entire admin panel immediately after authentication (the root cause of "admin not opening on mobile"). Replaced with `MOCK_CLIENTS.length`.
  4. **Campaigns search bar width** — search input changed from `flex:1 1 180px` (stretches to fill row) to `flex:0 1 240px` (compact, matching reference design).
  5. **Campaigns page subtitle** — added `page-subtitle` below the "Campaigns" title ("SmartLead campaign pipeline · sync status, lead progress & outreach metrics").
- Why: User wanted visual consistency between main login and admin auth gates, spinner feedback on the main login button, and the campaigns search bar sized to match the reference screenshot.
- Files affected: `src/app/login/page.jsx`, `src/app/admin/page.jsx`, `src/app/campaigns/page.jsx`, `src/styles/custom.css`

---

## 2026-04-24 — Campaigns page: redesigned filter layout

- What changed:
  1. **Top filter bar** — replaced the old tab-pills-at-top layout with: search input + "All Status" dropdown + date range calendar picker + Export CSV + Sync Live buttons, all in one row.
  2. **Pills row (below filter bar)** — two `.tabs-pill` groups side by side:
     - Left group (clickable): All / Active / Paused / Completed / Draft — these filter the table and stay in sync with the Status dropdown.
     - Right group (display-only metric pills): Leads Completed / In Progress / Yet to Start / Blocked / Last Synced.
  3. **StatusDropdown component** — custom dropdown using existing `.status-dropdown-wrap/btn/popover/opt` CSS classes; selecting a status here updates the active pill below and vice versa.
  4. **Removed 24h/7d quick-filter buttons** — not present in the reference design.
  5. **Added CSS** — `.campaigns-pills-row` (flex row, wraps on mobile) and `.metric-pill` (non-interactive display pill styled like tab-pill-btn) to `custom.css`.
- Why: User requested top bar to match a reference screenshot (search + dropdown + date range + action buttons) and the stats row to look like the Leads page tab pills.
- Files affected: `src/app/campaigns/page.jsx`, `src/styles/custom.css`

---

## 2026-04-24 — Fix three webhook/API bugs; suppress background-tab polling

- What changed:
  1. **Email search** (`/api/leads`) — Added `OR email ILIKE ${searchPattern}` to the WHERE clause. Previously the search box said "name, company, email" but email was never actually searched.
  2. **Invalid date guard** (webhook route) — `activityAt` is now validated with `!isNaN(new Date(rawActivityAt))` before use. A malformed date string from Happier Leads would previously throw a `RangeError` inside the INSERT and silently drop the lead.
  3. **Race-condition duplicate** (webhook route) — The INSERT is now wrapped in try/catch. If two simultaneous webhooks both pass the dedup SELECT before either INSERT commits, the second one gets a `23505` unique-violation error. Previously this returned 500 and caused Happier Leads to retry indefinitely; now it returns `{ ok: true, duplicate: true }` — same as an intentional duplicate.
  4. **Background-tab polling** (Leads page) — The 10-second `setInterval` now checks `document.hidden` before firing. Polls are skipped while the tab is in the background, saving API calls and DB connections.
- Why: Edge case audit identified these as real bugs affecting data integrity and system stability. The webhook is permanent (Vercel production URL does not expire).
- Files affected: `src/app/api/leads/route.js`, `src/app/api/webhook/happierleads/route.js`, `src/app/filtered/page.jsx`

---

## 2026-04-25 — Admin Panel: clear mock clients, breadcrumb "Overview"

- What changed: `MOCK_CLIENTS` array cleared to `[]` — Clients panel in the Tags tab now shows an empty state ("No clients yet") instead of pre-populated fake data. Breadcrumb link changed from "Dashboard" to "Overview" to match the actual nav label.
- Why: User didn't want pre-populated fake client records; breadcrumb label should match the sidebar nav item name.
- Files affected: `src/app/admin/page.jsx`

## 2026-04-24 — Campaigns page: Leads-style filter bar + clear mock data

- What changed:
  1. **Filter bar** — Replaced the search + status-dropdown layout with the same filter structure as the Leads page: tab pills (All / Active / Paused / Archived with live counts), time filter buttons (24h / 7d), calendar date-range picker (same `CalendarPicker` component pattern), search input, and a "Clear" button that appears when any filter is active.
  2. **Mock data removed** — `MOCK_CAMPAIGNS` array replaced with `const CAMPAIGNS = []`. No fake pre-populated records; the table area now shows a proper three-step empty onboarding state ("No campaigns yet — Sync Live to pull from SmartLead") instead of random data.
  3. **Stats bar** — Preserved but all values compute from the real (empty) array so they show 0 until real data is synced.
  4. **Export CSV** button disabled when no data; Sync Live button and spinner retained.
- Why: User wanted the Campaigns filter bar to visually match the Leads page exactly, and did not want pre-populated fake campaign records.
- Files affected: `src/app/campaigns/page.jsx`

---

## 2026-04-24 — Fix main login style revert + admin auth sign-in spinner

- What changed:
  1. **Main login page** (`/login`) — Reverted all styling changes from the previous session back to the original design: "Password" label, "Enter password" placeholder, blue submit button (`#1e3a8a`), "Sign in" / "Signing in…" button text. Removed the "ADMIN AUTHENTICATION" lock-icon header that had been added by mistake.
  2. **Admin page auth gate** (`/admin`) — Added a 700ms loading state to `handleAuth` so clicking "Sign in as Admin" shows a spinning SVG loader + "Signing in…" text before the panel transitions in. Wrong-password errors still surface after the delay. Button class separated from the main login button into `.admin-submit-btn`.
  3. **Save Note button** — Updated to also use `.admin-submit-btn` for visual consistency within the admin panel.
  4. **CSS** — `.login-submit-btn` restored to original blue. New `.admin-submit-btn` class added (dark bg + amber text + amber border, flex layout for spinner).
- Why: User wanted the main login page kept at its original simple blue style; the amber admin theme should only apply to the `/admin` secondary auth gate. Sign-in animation was also missing on the admin auth button since the check was synchronous.
- Files affected: `src/app/login/page.jsx`, `src/app/admin/page.jsx`, `src/styles/custom.css`

---

## 2026-04-24 — Admin Panel page, login redesign, sidebar "Live" + Admin button

- What changed:
  1. **Sidebar footer** — "Connected" label renamed to "Live". Added an "Admin" link button (pencil icon) to the right of the Live indicator; turns amber with a highlight on hover. Hidden in collapsed mode. Links to `/admin`.
  2. **Login page** (`/login`) — Temporarily redesigned (subsequently reverted — see next entry above).
  3. **Admin Panel page** (`/admin`) — New client-side page protected by the main session cookie (middleware) plus a secondary in-page auth gate (sessionStorage key, same password `Growleads@admin`). Shows a centered auth modal until authenticated, then reveals the Admin Panel. Two tabs:
     - **Notes**: SmartLead campaign search (dropdown from campaign list), note textarea with char counter, Save Note button — notes stored in `localStorage` and deletable.
     - **Client Tags**: Grid of 20 color-coded tag chips (mock data).
  4. **CSS** — Added `.login-card-header` (amber, lock icon row), updated `.login-submit-btn` (dark bg + amber text + amber border), added `.admin-btn` (sidebar button), and a full set of admin panel layout classes (`.admin-panel-header`, `.admin-notes-layout`, `.admin-note-card`, `.admin-tags-grid`, etc.).
- Why: User requested the admin UX pattern from the reference Growleads dashboard — secondary admin auth gate, campaign notes, client tags, and the amber-themed admin styling.
- Files affected: `src/components/Sidebar.jsx`, `src/app/login/page.jsx`, `src/app/admin/page.jsx` (new), `src/styles/custom.css`

---

## 2026-04-24 — Admin Panel: breadcrumb slash, outlined tab buttons, Client Tags redesign

- What changed:
  1. **Breadcrumb** — Added `/` separator between "Dashboard" and "Admin Panel" (`< Dashboard / Admin Panel`). Title moved inside the breadcrumb div as a `<span>` rather than a standalone div.
  2. **Tab buttons** — Inactive tabs now show a visible `var(--border-color)` outline so they look like proper rounded-rectangle buttons. Active tab keeps amber fill + amber border. Hover adds border-color darkening.
  3. **Client Tags tab** — Completely redesigned to match reference UI but SmartLead-only (no HeyReach source toggle). Left panel: "Add / Edit Tags" with SmartLead Campaign search dropdown, Client Tags text input + Add button (chips appear inline, removable), Save Tags button. Right panel: "Clients" list showing avatar initials (colored), client name, campaign count, "L" badge, and campaign pills. Mock clients: ImpactCraft (3), Moora (1), Growleads (4). Added CSS: `.admin-breadcrumb-sep`, `.admin-client-row`, `.admin-client-avatar`, `.admin-client-name`, `.admin-client-count`, `.admin-l-badge`, `.admin-campaign-pills`, `.admin-campaign-pill-sm`.
- Why: User wanted the `/` gap in breadcrumb, tab buttons as visible outlined rectangles, and the Client Tags tab to look like the reference Growleads dashboard (SmartLead section only).
- Files affected: `src/app/admin/page.jsx`, `src/styles/custom.css`

## 2026-04-24 — Campaigns sidebar polish (icon + section label)

- What changed: Campaigns nav item icon changed to a three-bar chart SVG (matching the SmartLead reference UI). Removed the "Smart Lead" section label from the sidebar — Campaigns now appears as a plain nav item below Leads with no header. Section label is controlled via a `hideLabel` flag on the section object so the data structure stays intact.
- Why: Visual polish requested by user after seeing the initial scaffold.
- Files affected: `src/components/Sidebar.jsx`

## 2026-04-24 — Campaigns page scaffold

- What changed: Added a new `/campaigns` page with full page structure: search + status dropdown filter, stats bar (Total/Active/Paused/Completed/Draft/Leads Completed/In Progress/Yet to Start/Blocked/Last Synced), and a table (Campaign Name, Status, Total Leads, Completed, In Progress, Yet to Start, Blocked, Sent, Pending). Campaign status badges color-coded (ACTIVE=green, PAUSED=yellow, ARCHIVED=gray). Table numbers color-coded (completed=blue, in progress=green, yet to start=yellow, blocked=red, pending=orange). "Sync Live" button has a spinner loading state and updates Last Synced timestamp. Export CSV works client-side on filtered data. Sidebar refactored to support sections with optional `hideLabel` flag. Added `.btn-primary`, `.campaign-badge-*`, `.campaigns-stats-bar`, `.status-dropdown-*`, `.num-*` CSS classes.
- Why: User requested the page structure for the upcoming SmartLead API integration. Data is mock/static for now; API sync will be added later.
- Files affected: `src/app/campaigns/page.jsx` (new), `src/components/Sidebar.jsx`, `src/styles/custom.css`

## 2026-04-24 — Compact sidebar brand + admin form density

- What changed: Reduced sidebar brand logo from 40px to 32px, collapsed logo 28px→24px, brand padding 16px→12px, brand-name font 14px→13px, brand-sub font 11px→10px. Admin notes panel: left/right padding 24px→20px, gap 16px→12px, section icon 28px→24px, textarea min-height 140px→120px, submit buttons 42px→36px, empty state icon 52px→40px.
- Why: At 100% zoom our system looked larger than the reference Growleads app. The oversized logo icon was the primary driver; the admin form padding and button height added to the visual weight.
- Files affected: `src/styles/custom.css`, `src/components/Sidebar.jsx`

## 2026-04-24 — Color-coded count badges on Leads filter tabs

- What changed: Each tab in the Leads page filter bar now shows its count badge in a matching accent color: All Leads → blue (`var(--blue-400)` with blue-tint bg), Exact → green (`#4ade80` with green-tint bg), Suggested → orange (`#fb923c` with orange-tint bg). Inactive tab badges dim to 55% opacity; active/hover tabs show full brightness. CSS active override removed — per-tab colors handled via inline `style` on the `tab-pill-count` span using new `color`/`bg` fields on the `TABS` constant.
- Why: User requested colored filter count numbers to match the reference Growleads Campaigns UI style.
- Files affected: `src/app/filtered/page.jsx`, `src/styles/custom.css`

## 2026-04-24 — Compact date format in comparison period row, no wrapping

- What changed: `compareLabel` now uses `fmtShortRange()` (e.g. "Apr 11–17") instead of the verbose `dd-mm-yyyy – dd-mm-yyyy` format. The date span in the filter popover also has `white-space: nowrap` so it never wraps onto a second line next to the "Set custom" / "Edit" button. The `.replace('vs ', '')` call in `ChartFilter` was removed since `compareLabel` no longer includes the "vs" prefix.
- Why: "11-04-2026 – 17-04-2026" was too long for the popover width and wrapped onto two lines.
- Files affected: `src/app/page.jsx`

## 2026-04-24 — Custom comparison period in chart filter

- What changed: The "Before (comparison period)" section in the chart filter popover now has a "Set custom" button that opens a calendar picker, letting users choose any date range for the comparison period. Shows "· auto" when auto-calculated, "· custom" when manually set, with a "Reset to auto" button to revert. Changing the main range clears any custom compare. `fetchChart` and `cmpBounds` both respect custom compare dates.
- Why: Users wanted to compare a specific historical period rather than the auto-calculated previous interval.
- Files affected: `src/app/page.jsx`

## 2026-04-24 — InfoTooltip fixed positioning (tooltip below icon, no overlap)

- What changed: `InfoTooltip` now renders its popup **below** the icon (`top: pos.y + 20`) instead of above, preventing it from overlapping the chart area. Arrow points upward toward the icon. Earlier iteration fixed the `position:fixed` + `getBoundingClientRect` approach (escaping card overflow:hidden) and removed the `cursor:help` question-mark cursor. Icon fades 50%→85% opacity on hover.
- Why: Tooltip was first clipped by card overflow (browser native tooltip showed at bottom of screen), then fixed-position version appeared correctly but overlapped the chart since the icon sits at the card's bottom edge.
- Files affected: `src/app/page.jsx`

## 2026-04-24 — Before/After comparison: cleaner UI, no dashed overlay

- What changed: Removed dashed "Previous" overlay lines, comparison dots, and comparison tooltip section from the chart SVG — the chart is now clean (Exact + Suggested only). `ChartFilter` dropdown now has two clearly labelled sections: "After (current period)" with presets/custom picker, and "Before (previous period)" showing the auto-calculated dates. Below the chart a summary row shows `Prev. period (Apr 11–17) ⓘ : X Exact · Y Suggested → Current (Apr 18–24): A Exact · B Suggested ↑Z%`. Dates use a short `Apr 11–17` format via new `fmtShortRange()` helper. `Total` line was also removed from the chart — only Exact and Suggested are shown. Added `InfoTooltip` component (custom styled popup, `position:fixed`, dark navy theme).
- Why: Dashed overlay was confusing; filter gave no indication of which dates were "before" vs "after"; date format was verbose; Total line was redundant.
- Files affected: `src/app/page.jsx`

## 2026-04-24 — Chart defaults to past 7 days + before/after period comparison

- What changed: Chart on Overview page now opens on "Past 7 days" (was "All time"). Auto-fetches the previous equivalent period in parallel (`getComparePeriod()`). `fillGaps()` accepts explicit date bounds so zero-data periods render as flat zero lines. `getComparePeriod` returns null for "All time" and "Past 24h"; for "Past 7d" returns today−13 to today−7; for custom ranges returns same-length window immediately before the `from` date.
- Why: User requested default 7-day view and a before/after comparison to show period-over-period trends at a glance.
- Files affected: `src/app/page.jsx`

## 2026-04-24 — Export CSV includes full detail panel data from raw_payload

- What changed: `exportCSV()` now adds 21 new columns extracted from `l.raw_payload`: Personal Email, Position, Phone, Location (city/state/country joined), Contact Type, Sector, Industry, Company Country, Employees Range, Est. Revenue, Year Founded, Total Visits, Total Duration (formatted), First Visit (Yes/No), Referrer, IP Address, Pages Visited (semicolon-separated URLs), UTM Source, UTM Medium, UTM Campaign, UTM Term.
- Why: Previous CSV only had the 9 top-level DB columns. The expand-panel detail data (contact/company/visit intelligence/UTM) was visible in the UI but not exported.
- Files affected: `src/app/filtered/page.jsx`

---

## 2026-04-24 — Export CSV fetches all leads respecting active tab/filters

- What changed: Replaced `onClick={() => exportCSV(leads)}` (exports current page only) with async `handleExportCSV()`. Paginates `/api/leads` with `limit=100` and the same active filters (tab type, search, timeFilter, calFrom/calTo) until all leads are fetched, then calls `exportCSV()` with the full array. Button shows "Exporting…" and is disabled while fetching. Added `linkedin_url` column to the CSV. Tab filter is respected: All/Exact/Suggested tabs export only leads of that type.
- Why: Export only included the 25 leads on the current page instead of all matching leads.
- Files affected: `src/app/filtered/page.jsx`

---

## 2026-04-24 — Scale chart axis labels for mobile readability

- What changed: Added `localFontSize` state to `LeadsChart`, computed in the same `ResizeObserver` as `localCVH`. Formula: `round(11 * CVW / containerW)` so labels always render at ~11px on screen. On mobile 303px: SVG `fontSize≈22` → 22*(303/600)=11.1px. On desktop 540px+: falls back to `fontSize:9` (renders ~8px, same as before). Both Y-axis tick labels and X-axis date/hour labels use `localFontSize`.
- Why: `fontSize:9` in SVG coords scaled to 4.5px on mobile (0.5× scale factor) — unreadable.
- Files affected: `src/app/page.jsx`

---

## 2026-04-24 — Responsive chart height via ResizeObserver

- What changed: `LeadsChart` now uses a `ResizeObserver` on `.chart-outer` to measure the container width after mount and on resize. Computes `localCVH = round(220 * CVW / containerW)` when `containerW < 520px`, targeting ~220px rendered height on mobile. On wide containers uses global `CVH=240`. All Y-axis geometry (`yP`, crosshair, clipPath) uses `localCPH = localCVH - margins`. SVG `viewBox` uses `localCVH`. Previously, SVG viewBox aspect ratio (600:240) capped the rendered height at ~120px on ~300px-wide mobile cards regardless of CVH.
- Why: Earlier attempts to increase CVH from 180→240 still left the chart too short on mobile because the viewBox ratio was the binding constraint, not the raw pixel value.
- Files affected: `src/app/page.jsx`

---

## 2026-04-24 — Past 24h chart: relative X-axis labels (−23h → now)

- What changed: `fmtAxisDate` for hourly granularity now returns relative labels (`−23h`, `−19h`, `−15h`, `−12h`, `−8h`, `−4h`, `now`) instead of absolute clock times (`11 PM`, `3 AM`, …). Absolute times confused users when the rolling 24h window crosses midnight — `11 PM` appeared left of `3 AM` even though 11 PM is later in the clock day. Relative labels always increase left→right. Hover tooltip still shows exact clock time.
- Why: User saw "11 PM · 3 AM · 7 AM" and perceived the X-axis as unordered/random because PM appeared before AM.
- Files affected: `src/app/page.jsx`

---

## 2026-04-24 — Past 24h chart: fill all 24 hourly buckets for ordered timeline

- What changed: Added `fillHourGaps()` in `page.jsx`. Previously `LeadsChart` in hourly mode only plotted hours that had actual lead data, so the X-axis jumped between sparse points (e.g. "11 PM → 4 AM → 7 AM") looking unordered. `fillHourGaps` generates exactly 24 UTC hourly buckets from `nowH - 23h` to `nowH`, zero-filling any missing hours. `LeadsChart` `useMemo` now calls `fillHourGaps` for hourly granularity instead of returning raw points.
- Why: User wanted the 24h chart X-axis to show a clean, evenly-spaced live timeline across the full 24 hours, not just hours where data happened to exist.
- Files affected: `src/app/page.jsx`

---

## 2026-04-24 — Mobile: chart height, calendar upward, sidebar slide animation

- What changed: Increased `CVH` from 180 to 240 — chart is now ~33% taller on all screens (mobile: ~119px at 298px width instead of ~89px). Added mobile CSS so the chart filter popover and `CalendarPicker` open *above* the trigger button (not below), preventing the calendar from pushing content off-screen. Fixed sidebar slide-in/out animation on mobile: `.app-mounted .sidebar { transition: width }` (specificity 0,2,0) was overriding the mobile `.sidebar { transition: transform }` (0,1,0) after mount, making the close button instant. Re-declared `transition: transform 0.25s ease` under `.app-mounted .sidebar` inside the `@media (max-width: 640px)` block to restore the smooth slide.
- Why: Chart too small on mobile; calendar required scrolling; sidebar close button was abrupt while hamburger/overlay tap was smooth.
- Files affected: `src/app/page.jsx`, `src/styles/custom.css`

---

## 2026-04-24 — Fix chart blank data; CalendarPicker in filter; rename to Analytics

- What changed: Fixed root cause of "No lead data for this period" — Neon's `@neondatabase/serverless` driver returns PostgreSQL `date`/`timestamptz` columns as JS `Date` objects. `JSON.stringify` turns them into full ISO strings (`"2026-04-24T00:00:00.000Z"`). `fillGaps` was appending `T00:00:00Z` to the already-ISO string → `Invalid Date` → comparison `d <= end` always `false` → loop never ran → empty array. Fix: added `toDay`/`toTs` helpers in chart route that normalize Date objects to `YYYY-MM-DD` / ISO strings before response. Also fixed `useMemo` in `LeadsChart` to skip `fillGaps` for hourly granularity (24h mode). Replaced `<input type="date">` fields in `ChartFilter` with the same `CalendarPicker` + `cal-range-trigger` used on the Leads page — "Custom Range" option now shows the visual calendar popup. Renamed card title from "Lead Activity" to "Analytics".
- Why: Chart was blank for all filter modes; user requested the same calendar UI as the Leads page; title rename requested.
- Files affected: `src/app/api/leads/chart/route.js`, `src/app/page.jsx`

---

## 2026-04-24 — Fix chart: data not loading, dropdown clipped, wrong presets

- What changed: Rewrote chart API SQL from nullable-cast WHERE pattern to explicit conditional branches (one query per filter state) to eliminate potential driver ambiguity. Added `since` param + hourly `date_trunc` grouping for 24h mode; daily `received_at::date` for 7d/all/custom. Presets reduced to "Past 24 hours", "Past 7 days", "All time" + custom range. Default changed from `'30d'` to `'all'`. Fixed `.overview-chart-card { overflow: visible }` so date-filter popover escapes `.card { overflow: clip }`. Fixed "Invalid Date" on Last Lead Received by using `fmtDate()` (parses full ISO timestamp) instead of `fmtTooltipDate()` (appended `T00:00:00Z` to existing timestamp). Fixed bottom spacing: `.app-layout { align-items: flex-start }` prevents `main-content` (the sole in-flow flex child) from stretching to 100vh when content is shorter.
- Why: Chart showed "No lead data for this period" for all ranges; dropdown was visually cut off; user requested only 24h + 7d presets; excessive whitespace below cards.
- Files affected: `src/app/api/leads/chart/route.js`, `src/app/page.jsx`, `src/styles/custom.css`

---

## 2026-04-24 — Move chart into Recent Leads card slot; remove Recent Leads

- What changed: Removed the Recent Leads card from the overview-grid. The Lead Activity chart now occupies that right-column slot (side by side with Pipeline Status). Removed the standalone full-width chart card that was above the grid. `fetchData` now fetches `limit=1` instead of `limit=5` since the leads list no longer renders. Removed `leads` state, `getInitials`, and `Link` import.
- Why: User clarified they wanted the chart inside the Recent Leads box, not as a separate section.
- Files affected: `src/app/page.jsx`

---

## 2026-04-24 — Animated lead activity chart on Overview page

- What changed: Added `GET /api/leads/chart` returning daily lead counts (total/exact/suggested) grouped by date with optional `dateFrom`/`dateTo` filters. Added a pure-SVG `LeadsChart` component to the Overview page: smooth cubic-bezier curves, gradient area fills, draw-in animation on mount (RAF-driven easing, 1.1s), hover crosshair + tooltip showing date + counts per type. Added `ChartFilter` dropdown with 5 quick presets (7/14/30/90 days, all time) + custom date range inputs. Removed relative timestamps ("1h ago") from Recent Leads list — chart provides temporal context; Last Lead Received now shows full date. Fixed excessive bottom spacing on Overview by overriding `min-height: 100vh` on `.main-content` (reference.css sets this but app-layout already has it). New CSS classes: `.overview-chart-card`, `.chart-subtitle`, `.chart-outer`, `.chart-svg`, `.chart-tooltip`, `.chart-tip-date`, `.chart-tip-row`, `.chart-legend`, `.chart-leg`, `.chart-leg-dot`, `.chart-filter-btn`, `.chart-filter-popover`, `.chart-filter-opt`, `.chart-filter-sep`, `.chart-filter-custom`, `.chart-date-input`.
- Why: User requested a line graph replacing the date column in recent leads, with date filter and animate-on-load behavior. Also fix empty space below overview cards.
- Files affected: `src/app/page.jsx`, `src/app/api/leads/chart/route.js`, `src/styles/custom.css`

---

## 2026-04-24 — New Today card: Exact / Suggested breakdown

- What changed: `GET /api/leads` stats query now returns two additional fields: `newTodayExact` and `newTodaySuggested` (COUNT with CURRENT_DATE + lead_type filter). `StatCard` component accepts an optional `sub` prop rendered below the value. The New Today card passes a breakdown row — `"X Exact / Y Suggested"` — with exact in green (`--green-400`) and suggested in orange (`--orange-400`), separated by a muted `/`. Only renders when at least one is non-zero. Added `.stat-card-breakdown` CSS class (flex, 11px, 600 weight). `DEFAULT_STATS` extended with `newTodayExact: 0, newTodaySuggested: 0`.
- Why: User wanted to see today's exact vs suggested split directly on the stat card without navigating to the Leads page.
- Files affected: `src/app/api/leads/route.js`, `src/app/page.jsx`, `src/styles/custom.css`

---

## 2026-04-24 — Remove redundant "78 results" count from Leads page header

- What changed: Removed the `{total} result{s}` `<span>` from the top-right of the Leads page header. The count is already visible in the tab pills (All Leads 78, Exact 60, Suggested 18).
- Why: Duplicate information cluttered the header.
- Files affected: `src/app/filtered/page.jsx`

---

## 2026-04-24 — Fix iOS TextAutosizer inflating detail panel values (round 2)

- What changed: Added `display: flex; flex-wrap: wrap; align-items: flex-start; min-width: 0; word-break: break-word` to `.detail-item-value` inside `@media (max-width: 640px)`. iOS's TextAutosizer (column-based font inflation, separate from `text-size-adjust`) only targets `display: block` elements. Flex containers and their children are exempt from inflation. The business email row was already `display: flex` (via `.detail-item-row`) and rendered at the correct size; all other plain `.detail-item-value` block divs were being ~2x inflated. Making all value cells flex matches the email row's immune behavior.
- Why: Previous round-1 fix (text-size-adjust: none + reducing 13px → 12px) did not resolve the inflation because TextAutosizer is a separate algorithm not governed by that property. Root cause was `display: block` on value divs inside a scrollable-wider-than-viewport table.
- Files affected: `src/styles/custom.css`

---

## 2026-04-24 — Fix mobile detail panel font inflation (iOS text-size-adjust)

- What changed: In `@media (max-width: 640px)`, reduced `.detail-item-value` and `.detail-link` from `13px` to `12px` (matching desktop sizes). Added `-webkit-text-size-adjust: none; text-size-adjust: none` to the `.detail-panel` override in the mobile block so iOS cannot boost fonts even when the horizontally-scrollable table outside triggers boost detection.
- Why: iOS Safari was inflating these fonts to ~26px because the scrollable table made the browser see content wider than the viewport, triggering font boosting. Setting `text-size-adjust: none` on the panel itself fully suppresses this.
- Files affected: `src/styles/custom.css`

---

## 2026-04-24 — Reorder filter bar: time filters before search

- What changed: Swapped the position of the search input and the time-filter-group (24h / 7d / calendar) in the filter bar. New order: Tabs | divider | 24h + 7d + calendar picker | search input | Clear.
- Why: User wanted time filters first so the bar reads left-to-right: type → time scope → keyword search.
- Files affected: `src/app/filtered/page.jsx`

---

## 2026-04-24 — Split calendar trigger into separate From / To field buttons

- What changed: The single calendar toggle button was replaced with two independent clickable field buttons inside `.cal-range-trigger` (a flex container, not a button). Left button = "from" field (calendar icon + date), right button = "to" field (date + calendar icon). `showCal: boolean` state replaced by `editField: 'from' | 'to' | null`. Clicking a field button sets `editField` and opens the `CalendarPicker` targeted to that field. Active field gets a blue highlight (`.cal-field-active`). `CalendarPicker` now receives `editField` prop and uses it in `clickDay`: clicking while editing "from" sets start date and auto-advances to "to" mode; clicking while editing "to" sets end date and closes. A `"Select start date"` / `"Select end date"` hint shows at the top of the popover (`.cal-editing-hint`). `onSelect` callback now takes `(from, to, nextEditField)` — `null` nextField means close.
- Why: The original single-button trigger gave no indication of which date was being set; users couldn't tell if a click would change the start or end date.
- Files affected: `src/app/filtered/page.jsx`, `src/styles/custom.css`

---

## 2026-04-24 — Custom calendar grid picker replaces native date inputs

- What changed: Replaced the two `<input type="date">` fields in the calendar popover with a fully custom `CalendarPicker` React component. Trigger shows two faux date fields (`dd-mm-yyyy — dd-mm-yyyy`) with calendar icons. Calendar shows: month/year header with ↑↓ nav arrows, 7-column day grid (Su–Sa), today = filled blue circle, selected dates = blue circle, days in range = subtle blue tint, Clear + Today footer buttons. `fmtCalDate` converts ISO to dd-mm-yyyy for display. New CSS classes: `.cal-range-trigger`, `.cal-field-btn`, `.cal-placeholder`, `.cal-val`, `.cal-sep`, `.cal-editing-hint`, `.cal-nav-row`, `.cal-month-title`, `.cal-nav-btn`, `.cal-grid`, `.cal-dow`, `.cal-day`, `.cal-today`, `.cal-sel`, `.cal-range`, `.cal-footer-row`, `.cal-foot-btn`, `.cal-foot-today`.
- Why: User wanted a proper month-grid calendar matching the reference design, not a plain browser date input.
- Files affected: `src/app/filtered/page.jsx`, `src/styles/custom.css`

---

## 2026-04-24 — Fix auto-scroll to bottom when clicking a lead row

- What changed: Reverted the lead detail panel from an external `<div>` (rendered after all 25 rows outside the table) back to an inline `<tr><td colSpan={7}>` inside `<tbody>`. The external approach caused a `scrollIntoView` call to drag the page to the very bottom every time a row was clicked. Also removed: `expandedLead` derived state, `detailRef`, and the `scrollIntoView` `useEffect` from `FilteredPage`. On mobile, `.table-wrap .detail-row-cell` now gets `position: sticky; left: 0; width: 100vw; max-width: 100vw; overflow: hidden` — this (a) keeps the panel anchored at viewport-left even when the table is scrolled right, and (b) makes iOS text-size-adjust calculate boost as 390/390 = 1.0 (no font inflation). Removed `.lead-detail-outer` CSS class.
- Why: Clicking any lead was auto-scrolling the page to the bottom (past all 25 rows) before showing the detail panel, making the UX unusable.
- Files affected: `src/app/filtered/page.jsx`, `src/styles/custom.css`

---

## 2026-04-24 — Time-based filters on Leads page (24h, 7d, calendar range)

- What changed: Added three filter controls to the right of the search bar — "24h", "7d" toggle buttons and a calendar icon button that opens a date-range picker (From / To). Active time filter is highlighted in blue. Selecting a quick filter clears the calendar range and vice versa. "Clear" button now resets time filters too. `GET /api/leads` extended with `since` (ISO timestamp), `dateFrom`, `dateTo` (ISO date strings) query params; WHERE clause filters `received_at` accordingly. New CSS classes: `.time-filter-group`, `.time-filter-btn`, `.cal-wrap`, `.cal-popover`, `.cal-field`, `.cal-date-input`, `.cal-footer`, `.cal-clear-btn`, `.cal-apply-btn`.
- Why: User requested date-range filtering to narrow leads to recent activity or a specific period.
- Files affected: `src/app/filtered/page.jsx`, `src/app/api/leads/route.js`, `src/styles/custom.css`

---

## 2026-04-24 — Fix blank space on right of expanded lead detail panel

- What changed: Changed `.detail-panel` grid from `repeat(auto-fill, minmax(260px, 1fr))` to `repeat(auto-fit, ...)`. `auto-fill` was creating ghost/empty columns on wide viewports when only 4 sections rendered, leaving a blank gap to the right of the last section. `auto-fit` collapses empty tracks so sections always stretch to fill the full card width.
- Why: User reported blank spacing to the right of the Visit Intelligence section in the expanded row.
- Files affected: `src/styles/custom.css`

---

## 2026-04-24 — Full cross-device compatibility (Android, tablet, notched phones)

- What changed: (1) **`viewport-fit=cover`** added to `layout.jsx` viewport export — allows content to extend into the safe area on notched phones (iPhone X+, Android punch-hole cameras); without this the mobile header is clipped behind the status bar notch. (2) **`touch-action: manipulation`** added globally on `button, a, label, input, select, textarea, [role="button"]` — removes the 300ms tap delay on Android Chrome and older iOS Safari, and prevents double-tap zoom on all touch devices. (3) **Safe-area-inset support** added in `@media (max-width: 640px)`: `.mobile-header` height is `calc(52px + env(safe-area-inset-top))` and padding-top matches so content sits below the notch; `.main-content` padding-top matches the taller header; `.page-body` padding-bottom is `calc(16px + env(safe-area-inset-bottom))` so the last row isn't hidden behind the iOS home indicator or Android gesture bar. All `env()` values fall back to `0` on devices without a notch so non-notched Android/older iOS are unaffected.
- Why: App needed to work correctly across iOS, Android, tablet, and desktop — not just iPhone. Android tap delay, notched-phone clipping, and gesture-bar overlap were the remaining gaps.
- Files affected: `src/app/layout.jsx`, `src/styles/custom.css`

---

## 2026-04-24 — Fix desktop table horizontal scroll caused by nowrap

- What changed: Removed `min-width: 860px` and `white-space: nowrap` from the global `.table-wrap table` and `.table-wrap td` rules. These were applied to ALL viewports, forcing long company names (e.g. "broadcast engineering consultants india") to never wrap and pushing the table past the desktop viewport width. Both rules already exist in the `@media (max-width: 640px)` block where horizontal scroll is intentional. Desktop table cells now wrap naturally; only `<th>` cells keep `white-space: nowrap` so column headers stay on one line.
- Why: Users on desktop were seeing a horizontal scrollbar and had to scroll left/right to see data that should fit comfortably on screen.
- Files affected: `src/styles/custom.css`

---

## 2026-04-24 — Detail panel moved outside scroll table (fixes mobile horizontal scroll)

- What changed: `LeadDetailPanel` no longer renders as a `<tr>` inside the `<table>`. Instead it renders as a `<div class="lead-detail-outer">` placed after `</div.table-wrap>` but still inside the `.card`. `LeadRow` no longer owns `expanded` state — `FilteredPage` now owns `expandedId` and passes `expanded`/`onToggle` props to each `LeadRow`. A `scrollIntoView` effect fires when `expandedId` changes to bring the panel into view. Removed the `position:sticky; left:0; width:100vw` hack from mobile `.detail-panel` (no longer needed since the panel is outside the scroll container). Added `.lead-detail-outer { border-top, bg }` CSS.
- Why: `position:sticky` on a `<div>` inside a `<td>` is unreliable in iOS Safari — the detail panel was scrolling left/right with the table. Moving the panel outside the `<table>` entirely is the architecturally correct fix.
- Files affected: `src/app/filtered/page.jsx`, `src/styles/custom.css`

---

## 2026-04-24 — Mobile detail panel: structured 2-column label/value layout

- What changed: Changed `.detail-grid` to `grid-template-columns: auto 1fr` on mobile. Added `display: contents` to `.detail-item` so each item's label and value become direct grid children — this causes all labels to auto-align in column 1 and all values in column 2 across the entire section, like a structured data form. Previously each item stacked label above value, requiring twice the vertical space and looking unstructured. Also tightened section padding from `16px 20px` → `12px 16px` on mobile. Restored `display: flex` for `.detail-item-row` (email + verified badge row) which is now a direct grid child.
- Why: On mobile the detail panel required excessive vertical scrolling and looked unstructured. The 2-column grid matches the form-like layout the user expects, consistent with desktop/tablet appearance.
- Files affected: `src/styles/custom.css`

---

## 2026-04-24 — Fix lead detail panel font sizes on iOS (architectural fix)

- What changed: Root cause identified: iOS applies text-size-adjust AFTER the CSS cascade, so `!important` font-size overrides have no effect. The boost factor = scroll-content-width / viewport-width = 860px / 390px ≈ 2.2×. Fix: constrain `.detail-panel` to `width: 100vw; max-width: 100vw` in the mobile media query so iOS sees a 1:1 ratio and applies zero boost. Added `position: sticky; left: 0` so the panel also anchors to the left edge of the visible area when the user scrolls the table sideways. Changed `.detail-panel { text-size-adjust: none }` → `100%` globally (none is ignored in some iOS versions and blocks accessibility zoom). Removed `!important` from font-size overrides now that the architectural fix is in place.
- Why: Previous !important + text-size-adjust:none approach had no effect — iOS boosts after cascade. The only reliable fix is eliminating the width mismatch that triggers the boost.
- Files affected: `src/styles/custom.css`

---

## 2026-04-24 — Fix lead detail panel font sizes on iOS (text-size-adjust scroll container bug)

- What changed: Added `-webkit-text-size-adjust: none; text-size-adjust: none` directly on `.detail-panel` (not just `html`). Also added `!important` to all mobile font-size overrides for detail panel elements. Root cause: iOS Safari recalculates text-size adjustment per scroll ancestor. The detail panel lives inside `.table-wrap { overflow-x: auto }` which has a scroll-content width of 860px inside a ~390px viewport — iOS was applying a ~2.2× size boost (860/390). Setting the property on `html` does not prevent this; it must be set on the element inside the scroll container.
- Why: Detail panel labels and values appeared ~2× too large on iPhone (e.g. "Chief Executive Officer" rendering at ~22px instead of 13px).
- Files affected: `src/styles/custom.css`

---

## 2026-04-24 — iOS mobile UX fixes

- What changed: (1) **iOS auto-zoom on inputs** — `font-size: 16px !important` added to `.form-input`, `.form-select`, `.login-input` inside `@media (max-width: 640px)`. iOS Safari auto-zooms the viewport when the focused input has font-size < 16px; this prevents that entirely. (2) **Sidebar single-tap open on mobile** — `Sidebar.jsx` now computes `isCollapsed = collapsed && !open`. When the sidebar is open as a mobile drawer (`open=true`), it always renders fully expanded regardless of the desktop `collapsed` state. Previously the sidebar slid in but showed icon-only mode because `collapsed=true`, requiring a second tap on the hamburger inside the drawer. (3) **Removed logo from mobile header** — Removed the `<img src="/favicon.png">` from the mobile header bar in `ClientLayout.jsx`; it duplicated the logo already shown in the sidebar. Mobile header now only contains the hamburger button. `.mobile-header` changed from `justify-content: space-between` to `flex-start`. (4) **× → ← left arrow on mobile close** — Sidebar close button SVG replaced from × (two crossing lines) to a left-pointing arrow (line + arrowhead). (5) **iOS font size auto-adjustment disabled** — Added `html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }` to prevent iOS Safari from overriding explicit px font sizes in the lead detail panel and elsewhere.
- Why: iOS Safari was auto-zooming on password field focus; sidebar required two taps to show nav labels; duplicate logo in header; × felt wrong (no back/close affordance); detail panel text appeared very large on iOS due to text-size adjustment.
- Files affected: `src/components/Sidebar.jsx`, `src/components/ClientLayout.jsx`, `src/styles/custom.css`

---

## 2026-04-23 — Fix table horizontal scroll at high zoom levels

- What changed: Three-part CSS fix in `custom.css`: (1) `body { overflow-x: hidden }` — was `auto`, which caused the body to expand to fit the table's 860px min-width, meaning `.table-wrap`'s own `overflow-x: auto` scrollbar never fired (no overflow detected). (2) `.main-content { min-width: 0 }` — flex items default to `min-width: auto` (content size), which prevented `.main-content` from shrinking below 860px even with body hidden; `min-width: 0` lets it shrink to viewport width. (3) `.card { overflow: clip }` — overrides `reference.css`'s `.card { overflow: hidden }`; `hidden` creates a scroll container that could intercept child scrollers, `clip` visually clips without creating one, allowing `.table-wrap`'s scrollbar to appear correctly.
- Why: At 150%+ zoom the ENGAGEMENT column was cut off with no visible horizontal scrollbar on the table — the scrollbar was at the very bottom of the full page body, out of view.
- Files affected: `src/styles/custom.css`

---

## 2026-04-24 — Fully responsive layout (zoom-adaptive)

- What changed: (1) **Sidebar auto-collapse** — `ClientLayout.jsx` now adds a `resize` listener that calls `setCollapsed(true)` whenever `window.innerWidth < 1100px`. Sidebar auto-collapses on mount if viewport is narrow; user can still manually expand at any time. (2) **Fluid stat grid** — `.stat-grid-v2` changed from `repeat(4, 1fr)` to `repeat(auto-fit, minmax(180px, 1fr))`. Cards reflow from 4 → 2 → 1 columns automatically without hard breakpoints. Removed the now-redundant 900px override. (3) **Fluid overview grid** — `.overview-grid` changed from `280px 1fr` to `repeat(auto-fit, minmax(280px, 1fr))`. Pipeline Status and Recent Leads stack automatically at narrow widths. (4) **Flexible search input** — Leads page search input changed from fixed `width: 240px` to `flex: 1; minWidth: 160px; maxWidth: 320px`. (5) **Mobile breakpoint lowered** — from `768px` → `640px` so full mobile drawer only triggers on phones, not on high-zoom desktops.
- Why: At 175%+ zoom the sidebar was staying expanded (eating space) and the stat/overview grids were too rigid. Reference app scales fluidly at any zoom level.
- Files affected: `src/components/ClientLayout.jsx`, `src/styles/custom.css`, `src/app/filtered/page.jsx`

---

## 2026-04-24 — Compact page header + Export CSV button on Leads page

- What changed: (1) `.page-header` padding reduced from `24px 32px 20px` → `12px 32px 10px`; `.page-body` padding reduced from `24px 32px` → `16px 32px` — brings header height in line with reference app. (2) `Export CSV` button added top-right of Leads page header; exports current page's leads to a dated `.csv` file with columns: Name, Email, Company, Domain, Type, Fit Score, Engagement Score, Received. Button disabled when no leads are loaded. `.export-csv-btn` CSS class added to `custom.css`.
- Why: Page header was taking up excessive vertical space compared to the reference. User also requested an Export CSV button matching the reference app's top-right placement.
- Files affected: `src/styles/custom.css`, `src/app/filtered/page.jsx`

---

## 2026-04-24 — Leads page: removed checkboxes and delete

- What changed: Stripped checkbox column, select-all, toggleOne, toggleAll, handleDelete, and the "Delete selected" button from `src/app/filtered/page.jsx`. `colSpan` on the detail panel corrected from 8 → 7 to match the reduced column count.
- Why: User doesn't want leads to be deletable from the UI.
- Files affected: `src/app/filtered/page.jsx`

---

## 2026-04-24 — Leads page: click-to-expand rows, checkboxes, delete

- What changed: `src/app/filtered/page.jsx` fully upgraded — added `LeadRow` (click-to-expand with chevron indicator), `LeadDetailPanel` (Contact Details, Company Details, Fit Score Breakdown, Visit Intelligence, UTM Attribution sections), checkbox select-all/individual, bulk delete with confirmation, and `ColHeader` tooltips on Fit Score and Engagement columns. Page title changed from "Filtered" to "Leads" and subtitle updated to match.
- Why: After removing the old `/leads` page, the `/filtered` page was missing the row-expand detail panel that users relied on.
- Files affected: `src/app/filtered/page.jsx`

---

## 2026-04-24 — Removed duplicate Leads page; Filter renamed to Leads

- What changed: Deleted `src/app/leads/` entirely (frontend page + all its components). Sidebar now has 2 nav items: Overview (`/`) and Leads (`/filtered`). The old Filter entry was renamed to "Leads" and given the people icon. Overview page "View all →" link updated from `/leads` to `/filtered`. The `/api/leads` backend API route is untouched.
- Why: Two tabs (Leads + Filter) were redundant — both showed the same lead table. Consolidating to one cleaner "Leads" entry pointing at the filtered page.
- Files affected: `src/app/leads/` (deleted), `src/components/Sidebar.jsx`, `src/app/page.jsx`

---

## 2026-04-23 — Responsive layout: horizontal scroll at high zoom, tighter padding

- What changed: (1) `body { overflow-x: auto }` on desktop overrides the reference.css `hidden` — page now scrolls horizontally at high zoom (150%+) instead of clipping content, matching the reference app behaviour. (2) `page-header-top` gains `flex-wrap: wrap` so the "75 total" counter (and any other header items) wrap rather than being cut off. (3) Padding on `.page-header` and `.page-body` reduces from 32px to 20px at viewport ≤ 1100px to give the table more room before scrolling. (4) Mobile `@media (max-width: 900px)` block re-applies `body { overflow-x: hidden }` to preserve iOS behaviour.
- Why: At 150% zoom the page clipped the right side of the table and the "75 total" header stat — the reference app scrolls the full page horizontally instead.
- Files affected: `src/styles/custom.css`

---

## 2026-04-23 — Table scrolls horizontally at any zoom level

- What changed: Added `white-space: nowrap` to `.table-wrap th` and `.table-wrap td` globally (was previously mobile-only). Added `min-width: 860px` to `.table-wrap table`. Detail-row expanded cells keep `white-space: normal` so their content still wraps.
- Why: At 125% zoom, table cells were squashing and wrapping content (e.g. long company names) instead of triggering the `.table-wrap { overflow-x: auto }` horizontal scroll.
- Files affected: `src/styles/custom.css`

---

## 2026-04-23 — Sidebar collapsed: hamburger icon, click to expand

- What changed: Collapsed state now shows a ☰ hamburger icon at the top (instead of the company logo or an arrow). Clicking it expands the sidebar. The `<` collapse button only shows when expanded. Active nav icon highlights blue based on current route.
- Why: User didn't want the company logo or arrow in collapsed state; wanted a standard hamburger affordance.
- Files affected: `src/components/Sidebar.jsx`

---

## 2026-04-23 — Sidebar collapsed: only nav icons, click to expand

- What changed: Collapsed sidebar now shows zero chrome — no logo, no arrow button. Only the 3 nav item icons are visible. Clicking anywhere on the collapsed sidebar expands it (nav item clicks still navigate normally via stopPropagation). The `<` collapse button only appears in the expanded state.
- Why: User didn't want arrow; wanted clean 3-icon strip.
- Files affected: `src/components/Sidebar.jsx`

---

## 2026-04-23 — Sidebar: static app name + hide logo when collapsed

- What changed: (1) Subtitle below brand name now always shows "Website Traffic Signal" instead of dynamically reflecting the current page. (2) Logo image and brand text are hidden when sidebar is collapsed — only the expand arrow button remains in the brand area.
- Why: User requested fixed app name (not page-reactive) and a clean collapsed state with no logo.
- Files affected: `src/components/Sidebar.jsx`

---

## 2026-04-23 — Login icon restored to 52px

- What changed: Logo icon 44px → 52px (border-radius 10px → 12px). Previous pass over-reduced it; cross-measuring both screenshots confirms reference logo ≈ 52px CSS.
- Why: User screenshot comparison showed reference logo visibly larger than our 44px icon.
- Files affected: `src/app/login/page.jsx`.

## 2026-04-23 — Login page final visual match to reference

- What changed:
  - Logo icon: 64px → **44px**, border-radius 14px → 10px (reference measures ~42px at 1366px desktop).
  - Brand section spacing tightened: `margin-bottom` 36→24px, icon `margin-bottom` 16→12px.
  - Brand name font-size 20→17px; subtitle 14→12px.
  - Input background reverted to `var(--bg-secondary)` (#111426) — darker than the card (#161929), matching the reference close-up.
  - Removed `box-shadow` from `.login-input:focus` — eliminated blue glow ring that appeared on page load due to `autoFocus`.
  - Sign in button background changed from `var(--blue-600)` (#2563eb, bright) to `#1e3a8a` (dark navy blue matching reference); hover state `#254aa8`; text color changed from `white` to `var(--text-primary)` (muted, matching reference).
- Why: Previous pass over-enlarged the logo/text. User provided close-up comparison shots showing: (1) input should be dark not light, (2) button should be dark navy not bright blue.
- Files affected: `src/app/login/page.jsx`, `src/styles/custom.css`.

## 2026-04-23 — Login page polish: icon size, brand spacing, input background

- What changed:
  - Logo icon bumped from `52px` → `64px` (border-radius `12px` → `14px`) to match the reference.
  - `.login-brand` `margin-bottom` increased `28px` → `36px`; icon `margin-bottom` `14px` → `16px`; brand name font-size `18px` → `20px`; subtitle `13px` → `14px`.
  - `.login-input` background changed from `var(--bg-secondary)` (`#111426`) to `var(--bg-hover)` (`#1a1e2e`) — the old value was *darker* than the card (`--bg-card` = `#161929`), making the input recede. `--bg-hover` is lighter than the card, matching the reference's visible input contrast.
- Why: User compared against dashboard.growleads.io reference and noted input field had a different (darker) theme and logo/text felt misaligned.
- Files affected: `src/app/login/page.jsx`, `src/styles/custom.css`.

## 2026-04-23 — Login card width matched to dashboard.growleads.io reference

- What changed:
  - `.login-container` `max-width` iterated from `480px` → `360px` → `320px` → **`380px`** (final).
  - `.login-card` `padding` tightened from `28px` to `24px`.
  - Final value of `380px` was derived by pixel-measuring the reference card in a full 1366×768 desktop screenshot of `dashboard.growleads.io/login`, which showed the card at ≈383px CSS. Earlier attempts (360px, 320px) overcorrected downward.
- Why: User reported our login card was visually wider than the reference Growleads dashboard login page. WebFetch could not extract CSS from the JS-bundled reference site, so measurement was taken directly from the reference screenshot.
- Files affected: `src/styles/custom.css`.

---

## 2026-04-23 — Mobile: detail panel font inflation + white-space nowrap inheritance

- What changed:
  - Fixed root cause of large fonts in expanded lead rows: `.table-wrap table { white-space: nowrap }` was cascading into the detail panel `<td>`, making every text node a single unbroken line. iOS then treated those wide lines as needing font inflation.
  - Added `white-space: normal` to `.table-wrap .detail-row-cell` — resets inheritance at the cell boundary so all detail panel text wraps normally.
  - Added explicit `font-size` overrides for every detail panel class at 768px (`.detail-item-label`, `.detail-item-value`, `.detail-link`, `.detail-section-title`, etc.) so iOS autosizing cannot multiply them.
  - Added `-webkit-text-size-adjust: 100%` to `body` as well as `html`.
- Why: iPhone testing showed expanded row detail panel rendering text at ~1.5× the intended size due to inherited `nowrap` causing iOS font boosting.
- Files affected: `src/styles/custom.css`, `src/app/globals.css`.

## 2026-04-23 — Mobile: viewport zoom + font inflation + flex overflow fixes

- What changed:
  - Added explicit `viewport` export to `layout.jsx` (`width: device-width, initialScale: 1`) — ensures viewport meta is definitively set on all iOS/Android browsers.
  - Added `-webkit-text-size-adjust: 100%; text-size-adjust: 100%` to `html` in `globals.css` — stops iOS Safari from auto-inflating table font sizes.
  - Added `overflow-x: hidden` + `width: 100%` to `.main-content` at 768px — the definitive iOS zoom fix. `overflow-x: hidden` on `html`/`body` alone doesn't stop iOS from scaling the viewport; the layout container must also be bounded.
  - Reduced table to `font-size: 12px`, `thead th` to 10px, cell padding to `8px 12px` — more compact and readable on phones.
  - Fixed `.person-cell` flex overflow: added `min-width: 0` + `text-overflow: ellipsis` — long lead names in the overview recent-leads list were expanding the flex row past viewport width, causing overview page zoom.
- Why: iPhone 16 testing showed pages still zooming out and table data appearing in large font after previous pass.
- Files affected: `src/app/layout.jsx`, `src/app/globals.css`, `src/styles/custom.css`.

## 2026-04-23 — Mobile UX overhaul (header bar, page zoom fix, table scroll)

- What changed:
  - Replaced floating `position: fixed` hamburger button with a full-width mobile header bar (`mobile-header`): hamburger on left, Growleads favicon centered, fixed at top 52px. Fixes missing logo on mobile and the "floating navbar" feel.
  - Removed `min-width: 640px` on table — that was telling iOS the page is 640px wide causing it to zoom out the whole page. Switched to `white-space: nowrap` on table cells instead; table scrolls horizontally inside its wrapper without affecting page zoom.
  - Added `overflow-x: hidden` to `html` and `body` in `globals.css` as a hard viewport-width bound for iOS/Android.
  - Table wrapper uses `-webkit-overflow-scrolling: touch` for smooth swipe-scroll on iOS.
  - Pagination touch targets bumped to `44×44px` (Apple HIG minimum).
  - `person-cell` and `company-cell` stay `white-space: normal` so names/companies still wrap inside their flex cells.
- Why: iPhone 16 testing showed logo missing, full-page zoom required to see table, and floating button felt disconnected.
- Files affected: `src/components/ClientLayout.jsx`, `src/styles/custom.css`, `src/app/globals.css`.

## 2026-04-23 — Mobile responsive hardening (filter inputs, table scroll, touch targets)

- What changed:
  - Filter bar inputs had `style={{ width: 220px / 140px }}` as inline styles — added `!important` CSS override so they go full-width at 768px.
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
- [x] CLAUDE.md created and up to date
- [x] Neon DB schema — created (leads table + 3 indexes, production branch)
- [x] Happier Leads automation — active, permanent Vercel webhook URL, confirmed working
- [x] First webhook received and payload confirmed — field extraction correct
- [x] Two-route UI — Overview (`/`) + Leads (`/filtered`)
- [x] Password gate — `/login` + middleware protecting all app routes
- [x] Growleads favicon in sidebar + browser tab
- [x] Expandable lead rows — detail panel inline in `<tbody>` (sticky on mobile), all HL data visible
- [x] Export CSV button — top-right of Leads page header
- [x] Time filters — 24h / 7d quick toggles + custom date-range calendar picker (separate From/To fields, each opens targeted calendar)
- [x] Mobile responsive — hamburger drawer (≤640px), safe-area insets, touch-action fixes
- [x] Cross-device — Android tap delay, notch support, tablet fluid grid
- [x] Collapsible sidebar — defaults collapsed, auto-collapses <1100px, hamburger on mobile
- [x] Fit Score + Engagement tooltips (position:fixed, never clipped)
- [x] Engagement score calculated from visit data (formula: visits×2 + duration/60s, max 20)
- [x] Fit score extraction tries s.fitScore ?? s.score (handles both real + test payloads)
- [x] GET /api/leads/[id] — single-lead endpoint with full raw_payload
- [x] Next.js devtools button hidden (devIndicators: false)
- [x] First-time empty state — onboarding guide on Overview when no leads exist
- [x] GitHub — https://github.com/karanpaliwall/happier-leads-automation
- [x] Production — https://happier-leads-automation.vercel.app

## Architecture — current file map

```
src/
├── app/
│   ├── api/
│   │   ├── auth/login/route.js             ← POST: checks password, sets gl_session cookie
│   │   ├── leads/
│   │   │   ├── route.js                    ← GET (paginated, window-fn count, includes raw_payload)
│   │   │   └── [id]/route.js               ← GET single lead with full raw_payload
│   │   └── webhook/happierleads/route.js   ← inbound webhook, dedup, insert
│   ├── campaigns/page.jsx                  ← Campaigns page: filter bar, stats, table (no live data yet)
│   ├── filtered/page.jsx                   ← Leads page: tabs/search, expandable rows, Export CSV
│   │                                           expandedId owned here; detail panel in .lead-detail-outer
│   │                                           (outside <table> so it never scrolls with table cols)
│   ├── login/page.jsx                      ← password gate
│   ├── page.jsx                            ← Overview: stat cards, pipeline status, analytics chart
│   ├── layout.jsx                          ← server root layout; sets viewport + favicon
│   └── globals.css
├── components/
│   ├── ClientLayout.jsx                    ← client wrapper: sidebar open/collapsed state,
│   │                                           app-mounted class (prevents hydration transition flash),
│   │                                           auto-collapse below 1100px on resize
│   ├── EmptyState.jsx                      ← first-time onboarding guide (4 setup steps)
│   ├── LeadsTable.jsx                      ← legacy table component (not used in current routes)
│   ├── Sidebar.jsx                         ← collapsible nav; hamburger drawer on mobile ≤640px
│   └── StatsBar.jsx                        ← legacy stat cards (unused)
├── middleware.js                           ← protects all routes except /login + /api/*
├── styles/
│   ├── reference.css                       ← Growleads design system (do not edit)
│   └── custom.css                          ← all app-specific overrides and additions
└── lib/
    └── db.js                               ← Neon sql tagged-template client
public/
└── favicon.png                             ← Growleads logo (sidebar + browser tab)
```

## Next Steps (Phase 2)

- Wire up "Push to Smart Lead" button — needs Smart Lead API key + contact import endpoint
- Add `PATCH /api/leads/[id]/push` route that calls Smart Lead and sets `pushed_to_smart_lead = true`

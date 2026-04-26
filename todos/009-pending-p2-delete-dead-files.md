---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, cleanup, dead-code]
dependencies: []
---

# Delete dead files: LeadsTable.jsx, StatsBar.jsx, DELETE /api/leads, GET /api/leads/[id]

## Problem Statement
Four dead code artifacts remain in the codebase, confirmed by grep:

1. `src/components/LeadsTable.jsx` — 139 lines, never imported. Superseded by `LeadRow` + `LeadDetailPanel` inline in `filtered/page.jsx`. Confuses future readers about which table is "current".
2. `src/components/StatsBar.jsx` — 19 lines, never imported. Superseded by `StatCard` in `page.jsx`.
3. `src/app/api/leads/route.js` DELETE handler — the UI bulk-delete buttons were removed; no frontend calls this. Worse: it has no auth check (see #001), making it a publicly accessible destructive endpoint for no benefit.
4. `src/app/api/leads/[id]/route.js` — GET single lead, no current UI caller. The `LeadDetailPanel` reads `raw_payload` from the already-loaded list data, not this endpoint.

## Findings
- `grep -r "LeadsTable" src/` → 0 hits
- `grep -r "StatsBar" src/` → 0 hits
- `grep -r "/api/leads/" src/app` → 0 client-side fetch calls to `[id]` route
- UI delete buttons removed in commit from context log "2026-04-24 — Leads page: removed checkboxes and delete"

## Proposed Solution

Delete:
- `src/components/LeadsTable.jsx`
- `src/components/StatsBar.jsx`
- `src/app/api/leads/[id]/route.js` (and the `[id]` directory)
- The `DELETE` handler from `src/app/api/leads/route.js` (keep only `GET`)

**Pros:** Removes a live unauthenticated destructive API endpoint, reduces confusion, cleaner codebase
**Effort:** Small | **Risk:** Low (all confirmed unused)

## Acceptance Criteria
- [ ] `LeadsTable.jsx` deleted
- [ ] `StatsBar.jsx` deleted
- [ ] `src/app/api/leads/[id]/route.js` deleted
- [ ] `DELETE` export removed from `src/app/api/leads/route.js`
- [ ] Build passes after deletion (`npm run build`)
- [ ] No 404s or console errors in the running app

## Work Log
- 2026-04-27: Identified by code-simplicity-reviewer, architecture-strategist, and agent-native-reviewer during /ce-review

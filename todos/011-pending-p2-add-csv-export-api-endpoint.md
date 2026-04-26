---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, agent-native, api]
dependencies: ["001"]
---

# CSV export is client-side only — no server API equivalent for agents or automation

## Problem Statement
The Export CSV feature (`handleExportCSV` in `filtered/page.jsx`) runs entirely in the browser: paginate `/api/leads` in a loop → construct CSV string → create `Blob` → trigger download. An agent or automation script cannot produce a CSV because there is no `GET /api/leads/export` endpoint. The field mapping (including nested `raw_payload` destructuring for 30 columns) lives only in the browser-side function.

This also means any agent wanting to export data must reimplement pagination + serialization logic, and will silently diverge whenever the UI's CSV format changes.

## Findings
- `src/app/filtered/page.jsx:360-422` — `exportCSV()` function (client-side only)
- `src/app/filtered/page.jsx:608-631` — `handleExportCSV()` — sequential pagination loop, no parallelism
- No `GET /api/leads/export` route exists

## Proposed Solution

Add `GET /api/leads/export` that accepts the same filter params as `GET /api/leads` and returns a CSV response:

```js
// src/app/api/leads/export/route.js
import sql from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req) {
  const authErr = requireAuth();
  if (authErr) return authErr;

  // Same filter params as /api/leads
  // Fetch all matching rows (no pagination limit — or cap at 5000)
  // Build CSV string with same 30-column format as client exportCSV()
  // Return: new Response(csvString, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="leads.csv"' } })
}
```

The client `handleExportCSV` can then be simplified to a single `fetch('/api/leads/export?...')` triggering a file download.

**Pros:** Agents can produce CSVs, format is a single source of truth, removes pagination loop from client
**Effort:** Medium | **Risk:** Low

## Acceptance Criteria
- [ ] `GET /api/leads/export` returns CSV response with correct headers
- [ ] Supports same filter params: `type`, `search`, `since`, `dateFrom`, `dateTo`
- [ ] CSV format matches existing client-side export (same 30 columns)
- [ ] Client `handleExportCSV` updated to call the server endpoint
- [ ] Route is auth-protected (depends on #001)

## Work Log
- 2026-04-27: Identified by agent-native-reviewer during /ce-review

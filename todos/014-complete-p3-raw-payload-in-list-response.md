---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, performance, api]
dependencies: ["009"]
---

# raw_payload returned in every list response — 80-90% payload size savings possible

## Problem Statement
`GET /api/leads` fetches `raw_payload` for every row in the list. Each `raw_payload` is 2–10 KB of JSONB. With 25 rows per page, every 10-second poll sends 50–250 KB to the browser — even though the table view only uses top-level columns. The payload is only needed when a row is expanded.

## Findings
- `src/app/api/leads/route.js:35` — `raw_payload` included in the `SELECT`
- With 25 leads × ~5 KB avg = ~125 KB per poll tick
- `GET /api/leads/[id]` exists to fetch full detail per-lead (but would be deleted by #009 as it has no current caller)

## Proposed Solution

Two-stage approach:
1. Remove `raw_payload` from the paginated list query
2. When a row is expanded, fetch it from `GET /api/leads/[id]` — **but** keep that route alive (reverse #009's deletion of it)

```js
// route.js — remove raw_payload from SELECT
SELECT id, received_at, first_name, last_name, full_name, email, ...
  -- no raw_payload
FROM leads WHERE ...
```

```jsx
// filtered/page.jsx — on expand, fetch detail
async function handleExpand(id) {
  setExpandedId(id);
  if (!detailCache[id]) {
    const res = await fetch(`/api/leads/${id}`);
    const data = await res.json();
    setDetailCache(c => ({ ...c, [id]: data.raw_payload }));
  }
}
```

**Pros:** ~80-90% reduction in poll payload size, faster tab switching
**Cons:** Small latency on first expand (one extra fetch, ~100-200ms); subsequent expands are instant from cache
**Effort:** Medium | **Risk:** Low — revises #009's scope (keep `[id]` route but still delete DELETE)

## Acceptance Criteria
- [ ] `raw_payload` not included in `GET /api/leads` list response
- [ ] Expanding a lead row triggers `GET /api/leads/[id]` and renders the detail panel
- [ ] Re-expanding the same row uses cached detail (no second fetch)
- [ ] Poll payload size reduced by >70%

## Work Log
- 2026-04-27: Identified by performance-oracle and security-sentinel during /ce-review

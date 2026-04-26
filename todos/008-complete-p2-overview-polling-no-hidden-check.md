---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, performance, polling]
dependencies: []
---

# Overview page polling fires every 10s even when tab is in the background

## Problem Statement
`src/app/page.jsx` polls `/api/leads` every 10 seconds via `setInterval` with no `document.hidden` check. The Leads page (`filtered/page.jsx`) correctly guards its poll. On the Neon free tier, every background poll wastes a DB connection and compute credit. If both pages are open simultaneously, that is 12 unnecessary DB hits per minute from a single user.

## Findings
- `src/app/page.jsx:694` — `setInterval(fetchData, 10000)` with no `document.hidden` guard
- `src/app/filtered/page.jsx:601` — correctly does `if (!document.hidden) fetchLeads()` (the pattern to copy)

## Proposed Solution

Change `page.jsx:694` from:
```js
useEffect(() => { fetchData(); const iv = setInterval(fetchData, 10000); return () => clearInterval(iv); }, [fetchData]);
```

To:
```js
useEffect(() => {
  fetchData();
  const iv = setInterval(() => { if (!document.hidden) fetchData(); }, 10000);
  return () => clearInterval(iv);
}, [fetchData]);
```

**Effort:** XS (1 line) | **Risk:** None

## Acceptance Criteria
- [ ] Overview page does not fire API requests when tab is hidden/backgrounded
- [ ] Overview page resumes polling when tab becomes active (next tick after 10s)

## Work Log
- 2026-04-27: Identified by performance-oracle during /ce-review

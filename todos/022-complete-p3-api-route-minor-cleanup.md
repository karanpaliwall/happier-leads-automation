---
status: complete
priority: p3
issue_id: "022"
tags: [code-review, quality, architecture]
dependencies: [018, 019]
---

# Minor API route cleanup: null vs 0 for unavailable stats, simpler auth error, res.json()

## Problem Statement
Three small improvements to `src/app/api/heyreach/campaigns/route.js`:

1. **Null vs zero for unavailable stats** — `invitesSent: 0, accepted: 0, replies: 0` are semantically wrong; `0` implies "none sent" while `null` means "unknown". Once todo #018 removes these fields entirely this may be moot, but if a "stats available" flag approach is chosen instead, use `null`.

2. **`__authError` sentinel is indirect** — `hrGet` returns `{ __authError: true }` on 401, then `fetchOneCampaign` checks `info?.__authError` and re-throws. Cleaner to throw directly from `hrGet`:
```js
if (res.status === 401) throw new Error('HEYREACH_INVALID_KEY');
```
Then remove the `info?.__authError` check in `fetchOneCampaign`.

3. **`res.text()` + `JSON.parse()` → `res.json()`** — the manual parse allocates an extra string. Replace with:
```js
try {
  return await res.json();
} catch {
  return null;
}
```

## Findings
- `src/app/api/heyreach/campaigns/route.js:18` — sentinel return
- `src/app/api/heyreach/campaigns/route.js:20-22` — text+parse
- `src/app/api/heyreach/campaigns/route.js:33` — sentinel check
- `src/app/api/heyreach/campaigns/route.js:54-56` — hardcoded zeros (superseded by #018)

## Acceptance Criteria
- [ ] `hrGet` throws directly on 401, no sentinel object
- [ ] `hrGet` uses `res.json()` with try/catch, not `res.text()` + `JSON.parse()`
- [ ] No `__authError` property anywhere in the codebase

## Work Log
- 2026-04-28: Identified by simplicity + pattern-recognition agents during ce-review

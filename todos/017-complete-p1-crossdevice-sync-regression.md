---
status: pending
priority: p1
issue_id: "017"
tags: [code-review, performance, architecture]
dependencies: []
---

# Cross-device sync runs sequentially on every page load (regression)

## Problem Statement
The `sl-ids-migrated` / `hr-ids-migrated` guard was removed from both campaign pages. This turns a one-time migration into a sequential waterfall of POST requests on every page load. With 10 IDs not yet on the server, that's ~10 sequential `await fetch(...)` calls before the page renders its data. Additionally, there is no in-flight guard, so if the component remounts (navigation, React StrictMode double-invoke in dev) before the loop finishes, a second concurrent sync loop fires, causing duplicate POST requests.

## Findings
- `src/app/campaigns/page.jsx` — sync loop runs on every `loadIds()` call (every mount)
- `src/app/heyreach/campaigns/page.jsx` — same pattern, same file location
- Both pages: sequential `await` inside `for...of` loop = no parallelism, blocks UI
- Architecture agent: "race condition if component re-mounts before loop completes"
- Performance agent: "O(n) sequential waterfall, ~500ms+ at 10 IDs on cold Vercel function"

## Proposed Solutions

### Option A: Re-add the one-shot guard (simplest)
Add back the `*-ids-migrated` localStorage flag, but set it only after a successful sync. This restores the original behavior — migration happens once per browser, then never again. Cross-device sync is handled by the server being authoritative on subsequent loads.

**Pros:** One-line fix, no API changes. **Cons:** If a user clears localStorage after migration, IDs are lost (same as before the regression).

### Option B: Parallel batch sync (recommended)
Replace the sequential loop with `Promise.all`:
```js
const missing = localIds.filter(id => !serverIds.includes(id));
await Promise.all(missing.map(id =>
  fetch('/api/heyreach/campaign-ids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }).catch(() => {})
));
```
Add an in-flight ref to prevent concurrent mounts racing:
```js
const syncInFlight = useRef(false);
// at top of loadIds():
if (syncInFlight.current) return;
syncInFlight.current = true;
// at end:
syncInFlight.current = false;
```

**Pros:** Parallel, no race. **Cons:** Still runs every load (N API calls if IDs diverge).

### Option C: Bulk sync endpoint
Add `POST /api/heyreach/campaign-ids/bulk` accepting `{ ids: string[] }`. One round-trip, idempotent upsert. Apply same pattern to SmartLead.

**Pros:** Single round-trip. **Cons:** Requires new API route.

## Recommended Action
Option B for now (quick fix), Option C when SmartLead/HeyReach sync logic is being unified.

## Technical Details
- Affected files: `src/app/campaigns/page.jsx`, `src/app/heyreach/campaigns/page.jsx`
- Both pages have identical sync logic — fix both simultaneously

## Acceptance Criteria
- [ ] Sync loop does not block sequentially — parallel or guarded
- [ ] No duplicate POST requests on component re-mount
- [ ] Vercel cold function does not spend >200ms on sync before returning campaign data

## Work Log
- 2026-04-28: Identified during ce-review of HeyReach real data + sync commits

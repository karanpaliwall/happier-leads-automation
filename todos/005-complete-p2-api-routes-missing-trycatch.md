---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, reliability, error-handling]
dependencies: []
---

# API routes missing try/catch on DB calls — unhandled rejections on Neon cold starts

## Problem Statement
The webhook route has a `withRetry` helper wrapping every DB call, with explicit `try/catch` blocks returning structured error responses. None of the other routes have this. A Neon cold-start timeout during a page poll will throw an unhandled rejection and return a 500 with no body — the client silently gets nothing.

## Findings
- `src/app/api/leads/route.js:30` — `Promise.all([sql..., sql...])` has no try/catch; unhandled rejection on DB error
- `src/app/api/leads/route.js:13` — DELETE's `await sql` has try/catch only around `req.json()`, not the DB call
- `src/app/api/leads/[id]/route.js:5` — `await sql` completely unguarded
- `src/app/api/leads/chart/route.js:17-71` — three separate `await sql` branches, all unguarded
- Webhook route correctly wraps with `withRetry` (2 retries, exponential backoff) — this pattern should be consistent

## Proposed Solutions

### Option A: Move withRetry to lib/db.js + wrap all call sites (Recommended)
Extract `withRetry` from the webhook route into `src/lib/db.js` and export it. Then wrap each DB call in the three affected routes.

```js
// src/lib/db.js
import { neon } from '@neondatabase/serverless';
export const sql = neon(process.env.DATABASE_URL);
export async function withRetry(fn, retries = 2, baseDelayMs = 600) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); }
    catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
}
```

Then in each route:
```js
import sql, { withRetry } from '@/lib/db';
// ...
try {
  const rows = await withRetry(() => sql`SELECT ...`);
} catch (err) {
  console.error('[leads] DB error:', err);
  return Response.json({ error: 'DB error' }, { status: 500 });
}
```

**Pros:** Consistent with webhook pattern, adds retry resilience for cold starts, single source of truth for `withRetry`
**Cons:** Slight refactor of db.js export (currently default-only)
**Effort:** Small | **Risk:** Low

### Option B: Add try/catch without retry
Just wrap each call in try/catch returning a structured 500, without retry logic.

**Pros:** Faster to implement
**Cons:** Doesn't handle cold starts — requests will still fail on first DB wake, just with a structured error instead of unhandled rejection
**Effort:** Small | **Risk:** Low

## Recommended Action
Option A — move `withRetry` to `lib/db.js` and apply consistently.

## Technical Details
- **Affected files:** `src/lib/db.js`, `src/app/api/leads/route.js`, `src/app/api/leads/[id]/route.js`, `src/app/api/leads/chart/route.js`

## Acceptance Criteria
- [ ] `withRetry` exported from `src/lib/db.js`
- [ ] `GET /api/leads` returns structured `{ error }` 500 on DB failure, not unhandled rejection
- [ ] `DELETE /api/leads` DB call wrapped in try/catch
- [ ] `GET /api/leads/[id]` DB call wrapped in try/catch
- [ ] `GET /api/leads/chart` all DB branches wrapped in try/catch
- [ ] Webhook route imports `withRetry` from `lib/db.js` instead of defining it locally

## Work Log
- 2026-04-27: Identified by pattern-recognition-specialist during /ce-review

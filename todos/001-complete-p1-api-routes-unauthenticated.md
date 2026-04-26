---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security, auth]
dependencies: []
---

# All data API routes are publicly accessible with no auth

## Problem Statement
The Next.js middleware matcher explicitly excludes all `/api/*` paths from session checking. The three data-serving routes — `GET /api/leads`, `DELETE /api/leads`, `GET /api/leads/[id]`, `GET /api/leads/chart` — perform zero authentication internally. Any anonymous HTTP client on the internet can enumerate all leads (including full PII), delete records, and read analytics.

**Why it matters:** The dashboard is deployed publicly on Vercel. The production URL is in CLAUDE.md and the GitHub README. Any person with the URL can exfiltrate the entire leads database including emails, LinkedIn URLs, phone numbers, and company data — or bulk-delete everything.

## Findings
- `src/middleware.js:14-16` — matcher pattern `'/((?!_next|favicon\\.png|api/webhook|api/auth|login).*)'` passes all `/api/*` requests through unchecked
- `src/app/api/leads/route.js` — GET and DELETE handlers have no auth check
- `src/app/api/leads/[id]/route.js` — GET handler has no auth check
- `src/app/api/leads/chart/route.js` — GET handler has no auth check

## Proposed Solutions

### Option A: Auth helper in each route handler (Recommended)
Add a `requireAuth()` helper to `src/lib/auth.js` that reads the `gl_session` cookie and returns a 401 response if invalid. Call it at the top of each API handler.

```js
// src/lib/auth.js
import { cookies } from 'next/headers';
export function requireAuth() {
  const session = cookies().get('gl_session')?.value;
  if (session !== process.env.SESSION_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

// In each route:
export async function GET(req) {
  const authErr = requireAuth();
  if (authErr) return authErr;
  // ...
}
```

Apply to: `GET /api/leads`, `DELETE /api/leads`, `GET /api/leads/[id]`, `GET /api/leads/chart`.

**Pros:** Minimal change, no new deps, consistent with existing cookie pattern
**Cons:** Must be added to each route individually (4 routes)
**Effort:** Small | **Risk:** Low

### Option B: Extend middleware matcher to protect API routes
Change the middleware matcher to protect `/api/leads/*` routes too.

**Pros:** Single change point
**Cons:** Middleware cannot easily return JSON 401 (only redirects to /login), which breaks API callers
**Effort:** Small | **Risk:** Medium (breaks programmatic callers)

## Recommended Action
Option A — add `requireAuth()` helper and call it in all 4 affected routes.

## Technical Details
- **Affected files:** `src/middleware.js`, `src/app/api/leads/route.js`, `src/app/api/leads/[id]/route.js`, `src/app/api/leads/chart/route.js`
- **New file:** `src/lib/auth.js`

## Acceptance Criteria
- [ ] `GET /api/leads` returns 401 with no session cookie
- [ ] `DELETE /api/leads` returns 401 with no session cookie
- [ ] `GET /api/leads/[id]` returns 401 with no session cookie
- [ ] `GET /api/leads/chart` returns 401 with no session cookie
- [ ] Authenticated requests continue to work normally
- [ ] `/api/webhook/happierleads` and `/api/auth/login` remain public

## Work Log
- 2026-04-27: Identified by security-sentinel and agent-native-reviewer during /ce-review

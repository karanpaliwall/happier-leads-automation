---
status: complete
priority: p2
issue_id: "020"
tags: [code-review, security, auth]
dependencies: []
---

# SESSION_TOKEN has hardcoded fallback — auth fails open if env var missing

## Problem Statement
The auth library (`src/lib/auth.js`) falls back to the literal string `'gl-auth-v1'` when `SESSION_TOKEN` is not set:
```js
const expected = process.env.SESSION_TOKEN || 'gl-auth-v1';
```
If `SESSION_TOKEN` is not present in Vercel environment variables, the session cookie value is effectively public knowledge to anyone who reads this source code (it's in the git history). The app would appear to work correctly in production while being trivially bypassable.

## Findings
- `src/lib/auth.js` — hardcoded fallback literal

## Proposed Solution
Remove the fallback and fail hard if the env var is unset:

```js
const expected = process.env.SESSION_TOKEN;
if (!expected) return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
```

Also verify `SESSION_TOKEN` is set in Vercel production environment variables.

## Acceptance Criteria
- [ ] `SESSION_TOKEN` has no hardcoded fallback
- [ ] Server returns 500 (not a passable auth response) if `SESSION_TOKEN` is missing
- [ ] Verify env var is set in Vercel dashboard

## Work Log
- 2026-04-28: Identified by security-sentinel during ce-review

---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, security, auth]
dependencies: []
---

# Hardcoded password and static predictable session token in source code

## Problem Statement
The password `'Growleads@admin'` is a string literal in `login/route.js`. The session token `'gl-auth-v1'` is hardcoded in both the login route and the middleware. Both values are also documented in CLAUDE.md and docs/. Anyone with repo access sees them in plaintext.

Worse: the session token is a static, predictable string. Anyone who sees it in a browser cookie can manually set `gl_session=gl-auth-v1` in any browser and bypass the login without knowing the password at all.

## Findings
- `src/app/api/auth/login/route.js:6` — `password !== 'Growleads@admin'`
- `src/middleware.js:4` — `const SESSION_VALUE = 'gl-auth-v1'`
- `CLAUDE.md` — password documented in plaintext
- `docs/3-single-source-of-truth.md` — password likely documented

## Proposed Solutions

### Option A: Move to environment variables + rotate session token (Recommended)

```js
// .env.local
AUTH_PASSWORD=Growleads@admin      # keep same value, just move out of source
SESSION_TOKEN=<32-byte-random-hex> # rotate: openssl rand -hex 32

// login/route.js
if (password !== process.env.AUTH_PASSWORD) { ... }
response.cookies.set('gl_session', process.env.SESSION_TOKEN, { ... });

// middleware.js
const SESSION_VALUE = process.env.SESSION_TOKEN;
```

**Pros:** Removes secrets from code, rotates the predictable static token to a random value
**Cons:** Must add env vars to Vercel, must re-login after deploy (cookie value changes)
**Effort:** Small | **Risk:** Low

## Recommended Action
Option A. Do this alongside fix #001 (auth helper) since `requireAuth()` should also use `process.env.SESSION_TOKEN`.

## Technical Details
- **Affected files:** `src/app/api/auth/login/route.js`, `src/middleware.js`
- **Env vars to add:** `AUTH_PASSWORD`, `SESSION_TOKEN`

## Acceptance Criteria
- [ ] No hardcoded password string in source code
- [ ] No hardcoded session token string in source code
- [ ] Both values read from environment variables
- [ ] New random `SESSION_TOKEN` value set in Vercel environment variables
- [ ] Login continues to work with env-var-based values
- [ ] CLAUDE.md updated to reference env var instead of literal password

## Work Log
- 2026-04-27: Identified by security-sentinel and architecture-strategist during /ce-review

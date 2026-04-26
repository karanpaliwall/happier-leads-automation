---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, security, auth]
dependencies: []
---

# No rate limiting or brute-force protection on login endpoint

## Problem Statement
`POST /api/auth/login` accepts unlimited requests with no throttling, lockout, or IP restriction. The password `Growleads@admin` is short and dictionary-adjacent. An attacker can run an unlimited brute-force or credential-spray attack from any IP.

## Findings
- `src/app/api/auth/login/route.js:6` — plain string comparison, no rate limiting
- Explicitly excluded from middleware matcher, so any edge-level protection must be added manually

## Proposed Solutions

### Option A: Vercel rate limit config (Recommended — zero deps)
Add a `vercel.json` rate limit rule targeting the login route:

```json
{
  "rateLimit": {
    "routes": [
      { "path": "/api/auth/login", "limit": 10, "window": "60s" }
    ]
  }
}
```

**Pros:** No code change, no new dependency, managed by Vercel infra
**Cons:** Only works on Vercel Pro (may not be available on free tier); check plan
**Effort:** Small | **Risk:** Low

### Option B: Simple in-memory IP counter in the route handler
Track failed attempts per IP using a `Map` in module scope, block after 10 failures within 60s.

**Pros:** Works on any plan, no deps
**Cons:** Not shared across serverless instances (each cold start gets a fresh counter), resets on redeploy
**Effort:** Small | **Risk:** Low (good enough for internal tool)

### Option C: @upstash/ratelimit + Redis
Use Upstash Redis for distributed rate limiting. Accurate across all serverless instances.

**Pros:** Production-grade, persistent across instances
**Cons:** New dependency + paid service
**Effort:** Medium | **Risk:** Low

## Recommended Action
Option A first (check Vercel plan). Fall back to Option B if not available on current plan.

## Technical Details
- **Affected file:** `src/app/api/auth/login/route.js`
- **New file (option A):** `vercel.json`

## Acceptance Criteria
- [ ] Login endpoint returns 429 after 10 failed attempts within 60 seconds from same IP
- [ ] Successful login still works within the rate limit window
- [ ] Rate limit resets after the window expires

## Work Log
- 2026-04-27: Identified by security-sentinel during /ce-review

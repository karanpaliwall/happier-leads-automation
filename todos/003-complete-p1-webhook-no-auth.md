---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, security, webhook]
dependencies: []
---

# Webhook endpoint has no authentication — arbitrary lead data injection possible

## Problem Statement
`POST /api/webhook/happierleads` is publicly accessible with no HMAC signature verification, shared secret, or IP allowlist. Anyone who knows the URL can POST fabricated JSON and inject arbitrary lead records into the database. The full raw payload is stored verbatim as JSONB.

The production URL is documented in CLAUDE.md and was committed to the public GitHub repo via the README.

## Findings
- `src/app/api/webhook/happierleads/route.js:16` — no authentication before processing begins
- `src/middleware.js:15` — `api/webhook` explicitly excluded from session middleware
- URL is in README.md and CLAUDE.md

## Proposed Solutions

### Option A: Secret token in URL path/query param (Recommended — simplest)
Add a `WEBHOOK_SECRET` env var and validate it on every request:

```js
const secret = process.env.WEBHOOK_SECRET;
const token = new URL(req.url).searchParams.get('token');
if (!secret || token !== secret) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Update the Happier Leads webhook URL to include `?token=<secret>`.

**Pros:** Supported by all webhook providers, trivial to implement
**Cons:** Token visible in HL dashboard UI and server logs — acceptable for internal tool
**Effort:** Small | **Risk:** Low

### Option B: HMAC signature header (if HL supports it)
Check whether Happier Leads sends an `X-Webhook-Signature` or similar header and validate it.

**Pros:** More secure (token not in URL)
**Cons:** Requires checking HL docs; may not be supported
**Effort:** Small-Medium | **Risk:** Low

## Recommended Action
Option A immediately (unblock the P1). Investigate Option B once HL docs confirm whether they support signing.

## Technical Details
- **Affected file:** `src/app/api/webhook/happierleads/route.js`
- **Env var to add:** `WEBHOOK_SECRET` (generate with `openssl rand -hex 32`)
- **Vercel action:** Add `WEBHOOK_SECRET` to Vercel environment variables

## Acceptance Criteria
- [ ] Requests to webhook without valid token return 401
- [ ] Requests with valid `?token=<secret>` are processed normally
- [ ] `WEBHOOK_SECRET` is set in Vercel production env vars
- [ ] Happier Leads automation URL is updated with token

## Work Log
- 2026-04-27: Identified by security-sentinel during /ce-review

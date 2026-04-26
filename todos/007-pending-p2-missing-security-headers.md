---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, security, headers]
dependencies: []
---

# No HTTP security headers configured in next.config.js

## Problem Statement
`next.config.js` sets no security headers. The following are absent: `X-Frame-Options` (clickjacking), `X-Content-Type-Options` (MIME sniffing), `Referrer-Policy` (leaks referrer to LinkedIn/company links), `Permissions-Policy`. The lead dashboard links out to LinkedIn URLs and company domains, so referrer leakage is a real concern.

## Findings
- `next.config.js` — no `headers()` export
- No CSP, no XFO, no `nosniff`, no `Referrer-Policy`

## Proposed Solution

Add to `next.config.js`:

```js
const securityHeaders = [
  { key: 'X-Frame-Options',        value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
];

// In module.exports:
async headers() {
  return [{ source: '/(.*)', headers: securityHeaders }];
},
```

**Effort:** Small | **Risk:** Low

## Acceptance Criteria
- [ ] `X-Frame-Options: DENY` present on all responses
- [ ] `X-Content-Type-Options: nosniff` present on all responses
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` present on all responses
- [ ] `Permissions-Policy` present on all responses

## Work Log
- 2026-04-27: Identified by security-sentinel during /ce-review

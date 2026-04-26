---
status: pending
priority: p3
issue_id: "016"
tags: [code-review, security, config]
dependencies: []
---

# Wildcard remotePatterns allows next/image to proxy any HTTPS URL

## Problem Statement
`next.config.js` has `remotePatterns: [{ protocol: 'https', hostname: '**' }]`, allowing Next.js's image optimization endpoint (`/_next/image?url=...`) to proxy images from any HTTPS host. This is an SSRF-adjacent relay and can be abused to exhaust Vercel bandwidth.

Note: The current UI uses plain `<img>` tags, not `<Image>` from `next/image`, so this config is not actively used. But the `/_next/image` endpoint is open to anyone who crafts a request.

## Findings
- `next.config.js:4` (or wherever remotePatterns is defined) — `hostname: '**'`

## Proposed Solution

Restrict to known logo domains:

```js
remotePatterns: [
  { protocol: 'https', hostname: '*.happierleads.com' },
  { protocol: 'https', hostname: 'logo.clearbit.com' },
  { protocol: 'https', hostname: '*.amazonaws.com' },
]
```

Or if company logo URLs are fully unpredictable, keep `**` but add a note documenting the tradeoff.

**Effort:** XS | **Risk:** Low

## Acceptance Criteria
- [ ] `remotePatterns` narrowed to specific hostnames or documented with known tradeoff
- [ ] Build passes with new config

## Work Log
- 2026-04-27: Identified by security-sentinel during /ce-review

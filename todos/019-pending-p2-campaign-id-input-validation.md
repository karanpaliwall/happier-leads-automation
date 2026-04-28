---
status: complete
priority: p2
issue_id: "019"
tags: [code-review, security]
dependencies: []
---

# Campaign IDs from URL query param not validated before use in upstream URL

## Problem Statement
`GET /api/heyreach/campaigns?ids=1,2,3` splits the `ids` param and interpolates each value directly into the HeyReach API URL: `/Campaign/GetById?campaignId=${id}`. An authenticated user can inject `&foo=bar` or other query parameters into the upstream HeyReach request. While SSRF is not possible (host is hardcoded), this allows an authenticated user to craft unexpected HeyReach API requests.

## Findings
- `src/app/api/heyreach/campaigns/route.js:67-68` — no validation on extracted IDs
- `src/app/api/heyreach/campaigns/route.js:31` — `id` interpolated directly into URL path

## Proposed Solution
Add a digit-only filter when parsing IDs from the query param:

```js
const ids = (new URL(request.url).searchParams.get('ids') ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(s => /^\d+$/.test(s))  // ← add this
  .slice(0, 20);
```

One line, zero risk of breakage. Campaign IDs from HeyReach are always integers.

## Acceptance Criteria
- [ ] IDs containing non-digit characters are silently dropped before use
- [ ] `?ids=123&foo=bar,456` only processes `456`, not `123&foo=bar`

## Work Log
- 2026-04-28: Identified by security-sentinel during ce-review

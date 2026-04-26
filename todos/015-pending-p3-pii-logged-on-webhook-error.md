---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, security, privacy]
dependencies: []
---

# Full PII payload logged to Vercel logs on webhook error

## Problem Statement
When all key identity fields are null (possible payload format change), the webhook logs the entire raw body including emails, phone numbers, LinkedIn URLs, and IP addresses to Vercel function logs. Vercel retains logs; inadvertent log sharing would expose PII.

## Findings
- `src/app/api/webhook/happierleads/route.js:64`:
  ```js
  console.error('[webhook] All key fields null — possible HL payload format change. Body:', JSON.stringify(body));
  ```

## Proposed Solution

Log structural metadata instead of the full body:

```js
console.error('[webhook] All key fields null — possible HL payload format change. Keys:', Object.keys(body ?? {}), 'contactKeys:', Object.keys(body?.contact ?? {}));
```

**Effort:** XS (1 line) | **Risk:** None

## Acceptance Criteria
- [ ] Full raw payload not logged on webhook error
- [ ] Log still provides enough info to diagnose a payload format change (top-level keys)

## Work Log
- 2026-04-27: Identified by security-sentinel during /ce-review

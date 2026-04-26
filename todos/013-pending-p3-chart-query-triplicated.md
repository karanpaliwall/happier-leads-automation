---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, cleanup, architecture]
dependencies: []
---

# chart/route.js has three near-identical SQL query branches — consolidate to one

## Problem Statement
The daily aggregation in `GET /api/leads/chart` branches into three almost-identical `SELECT` statements to handle optional `dateFrom`/`dateTo` params. The same project uses the nullable-cast pattern (`${x}::date IS NULL OR ...`) successfully in `GET /api/leads`. Applying it here would collapse three branches to one.

## Findings
- `src/app/api/leads/chart/route.js:40-71` — three separate `sql` template calls
- Lines 41-51 (`dateFrom + dateTo`), 52-61 (`dateFrom only`), 62-71 (all time) are identical except for WHERE conditions
- `src/app/api/leads/route.js` already uses the null-guard pattern correctly

## Proposed Solution

Consolidate the three daily branches to one query:

```sql
SELECT received_at::date AS day,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE lead_type = 'exact') AS exact,
  COUNT(*) FILTER (WHERE lead_type = 'suggested') AS suggested
FROM leads
WHERE (${dateFrom}::date IS NULL OR received_at::date >= ${dateFrom}::date)
  AND (${dateTo}::date IS NULL OR received_at::date <= ${dateTo}::date)
GROUP BY 1 ORDER BY 1
```

Keep the `since`-based hourly branch separate (different granularity).

**Effort:** Small | **Risk:** Low

## Acceptance Criteria
- [ ] Three daily-mode SQL branches collapsed to one parameterized query
- [ ] Chart still returns correct data for all filter combinations (since, dateFrom+dateTo, all-time)
- [ ] Hourly branch (`since`) unchanged

## Work Log
- 2026-04-27: Identified by architecture-strategist and pattern-recognition-specialist during /ce-review

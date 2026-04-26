---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, performance, database]
dependencies: []
---

# ILIKE search causes full sequential scan on every request — no index

## Problem Statement
The search query uses `ILIKE ${searchPattern}` on three columns. A leading `%` wildcard (`%term%`) prevents B-tree index usage, so PostgreSQL scans every row on every request — including background poll ticks where no search is active (`searchPattern = '%'`).

## Findings
- `src/app/api/leads/route.js:41-44` — three-column OR ILIKE with leading wildcard
- Default `searchPattern = '%'` means every no-search poll still runs a full scan across three ILIKE conditions
- No GIN/GiST full-text index exists on the `leads` table

## Proposed Solutions

### Option A: Null-guard the search condition (Quick win — do now)
The filter params already use `IS NULL OR ...` guards (e.g. `${type}::text IS NULL OR lead_type = ${type}`). Apply the same to search:

```sql
AND (${search}::text IS NULL
  OR company_name ILIKE ${searchPattern}
  OR full_name    ILIKE ${searchPattern}
  OR email        ILIKE ${searchPattern})
```

This lets Postgres skip the ILIKE scan entirely on every background poll that has no search term set. Zero migration needed.

**Effort:** XS | **Risk:** None

### Option B: GIN full-text search index (Do when dataset grows)
Add a generated `tsvector` column with a GIN index:

```sql
ALTER TABLE leads ADD COLUMN search_vec tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(full_name,'') || ' ' || coalesce(company_name,'') || ' ' || coalesce(email,''))
  ) STORED;
CREATE INDEX leads_search_vec_idx ON leads USING GIN(search_vec);
```

Then use `@@ plainto_tsquery('simple', ${search})` in the query.

**Effort:** Medium (requires migration) | **Risk:** Low

### Option C: Add index on received_at::date (Separate but related)
The date filter `received_at::date >= ${dateFrom}::date` doesn't use the existing `leads_received_at_idx` (timestamptz) because the cast breaks index matching. Add:

```sql
CREATE INDEX leads_received_date_idx ON leads ((received_at::date));
```

**Effort:** XS (one SQL statement) | **Risk:** None

## Recommended Action
Option A immediately (1-line fix). Option C alongside it (one SQL). Option B when dataset exceeds ~20k rows.

## Acceptance Criteria
- [ ] Search param null-guard added to `GET /api/leads` query
- [ ] Background poll ticks with no search term skip the ILIKE scan
- [ ] `leads_received_date_idx` index created in Neon

## Work Log
- 2026-04-27: Identified by performance-oracle during /ce-review

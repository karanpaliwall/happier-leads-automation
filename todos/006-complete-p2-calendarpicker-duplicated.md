---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, architecture, duplication]
dependencies: []
---

# CalendarPicker component copy-pasted identically in three page files

## Problem Statement
`CalendarPicker`, `CAL_MONTHS`, `CAL_DAYS`, and `fmtCalDate` are declared verbatim in three separate files. `page.jsx` even has a comment saying "shared with Leads page" — the intent was always to share it, but it was never extracted. `campaigns/page.jsx` already has a minor divergence (`clickToday` is inlined). Any bug fix or style change must be applied three times.

## Findings
- `src/app/page.jsx:363-449` — CalendarPicker definition #1
- `src/app/filtered/page.jsx:424-510` — CalendarPicker definition #2 (identical)
- `src/app/campaigns/page.jsx:6-90` — CalendarPicker definition #3 (minor divergence)
- `page.jsx:362` — comment "Calendar picker (shared with Leads page)" confirms intent was always to extract

## Proposed Solution

Extract to `src/components/CalendarPicker.jsx`:

```js
// src/components/CalendarPicker.jsx
export const CAL_MONTHS = [...];
export const CAL_DAYS   = [...];
export function fmtCalDate(iso) { ... }
export function CalendarPicker({ from, to, editField, onSelect, onClear }) { ... }
```

Replace all three inline definitions with:
```js
import { CalendarPicker, fmtCalDate } from '@/components/CalendarPicker';
```

**Pros:** Single source of truth, ~220 lines eliminated, future calendar changes are one edit
**Cons:** None — mechanical extraction
**Effort:** Small | **Risk:** Low

## Technical Details
- **New file:** `src/components/CalendarPicker.jsx`
- **Files to update:** `src/app/page.jsx`, `src/app/filtered/page.jsx`, `src/app/campaigns/page.jsx`
- **Net LOC change:** ~−220 lines (new file ~80 lines, remove ~300 total)

## Acceptance Criteria
- [ ] `src/components/CalendarPicker.jsx` exists and exports `CalendarPicker` and `fmtCalDate`
- [ ] `src/app/page.jsx` imports from the shared component, no local definition
- [ ] `src/app/filtered/page.jsx` imports from the shared component, no local definition
- [ ] `src/app/campaigns/page.jsx` imports from the shared component, no local definition
- [ ] Calendar behavior identical in all three pages after extraction

## Work Log
- 2026-04-27: Identified by architecture-strategist, pattern-recognition-specialist, and code-simplicity-reviewer during /ce-review

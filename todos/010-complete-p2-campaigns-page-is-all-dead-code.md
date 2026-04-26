---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, cleanup, dead-code, campaigns]
dependencies: ["006"]
---

# campaigns/page.jsx is 462 lines of fully implemented UI wired to an empty array

## Problem Statement
`const CAMPAIGNS = []` on line 4 means the page can never show anything. Every interactive component — `StatusDropdown`, `CampaignBadge`, `Num`, `exportCSV`, `CalendarPicker`, filter logic, metrics calculations — is dead execution. `handleSyncLive` uses `setTimeout` to fake a 1.5-second sync that calls no API and writes nothing. The "Last Synced" timestamp updates to a fake value.

This is YAGNI at scale: a complete feature shell for Phase 2 work that does not exist yet. It also contains the third copy of `CalendarPicker` (see #006), which is already diverging from the other two copies.

## Findings
- `src/app/campaigns/page.jsx:4` — `const CAMPAIGNS = []`
- `src/app/campaigns/page.jsx:223-226` — fake sync with `setTimeout`
- Third copy of `CalendarPicker` at lines 6–90
- ~440 lines of unreachable execution

## Proposed Solutions

### Option A: Collapse to placeholder (Recommended — now)
Replace entire file with a minimal placeholder component:

```jsx
'use client';
export default function CampaignsPage() {
  return (
    <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Campaigns — Coming Soon</p>
        <p style={{ fontSize: 12 }}>SmartLead integration is Phase 2. Check back once the API is wired up.</p>
      </div>
    </div>
  );
}
```

Restore the full UI when `GET /api/campaigns` exists and returns real data.

**Pros:** Removes ~440 dead lines, removes third CalendarPicker copy, removes fake sync feedback
**Cons:** Loses the UI skeleton (recoverable from git)
**Effort:** Small | **Risk:** Low

### Option B: Keep skeleton, remove fake feedback
Keep the UI structure but remove `handleSyncLive`'s fake setTimeout so the button does nothing until the real API exists. Add a comment at top: `// TODO: wire to GET /api/campaigns`.

**Pros:** UI skeleton preserved for Phase 2 reference
**Cons:** Third CalendarPicker copy remains and will diverge further
**Effort:** XS | **Risk:** Low

## Recommended Action
Option A if Phase 2 is more than 2 weeks away. Option B if Phase 2 starts next week.

## Technical Details
- **Affected file:** `src/app/campaigns/page.jsx`

## Acceptance Criteria
- [ ] No fake sync behavior (no `setTimeout` pretending to sync data)
- [ ] Third copy of `CalendarPicker` removed from this file (use shared component from #006 or delete entirely)
- [ ] Page renders something meaningful (either placeholder or real data)
- [ ] Build passes

## Work Log
- 2026-04-27: Identified by code-simplicity-reviewer and architecture-strategist during /ce-review

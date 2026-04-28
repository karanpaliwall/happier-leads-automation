---
status: complete
priority: p1
issue_id: "018"
tags: [code-review, architecture, quality]
dependencies: []
---

# acceptRate/replyRate columns always show "0 (0%)" — misleading UI and CSV

## Problem Statement
The HeyReach campaigns page has `acceptRate` and `replyRate` columns in the table and CSV export. The API route hardcodes `invitesSent: 0, accepted: 0, replies: 0` because the `GetCampaignStatsByCampaignId` endpoint is currently unavailable. This means every row permanently shows "0 (0%)" and every CSV export contains meaningless rate columns. A user or downstream consumer cannot distinguish "zero activity" from "data not available."

## Findings
- `src/app/api/heyreach/campaigns/route.js:54-56` — hardcoded zeros
- `src/app/heyreach/campaigns/page.jsx:13-27` — COLS includes `acceptRate`/`replyRate`
- `src/app/heyreach/campaigns/page.jsx:737-738` — `acceptPct`/`replyPct` computed but always 0
- `src/app/heyreach/campaigns/page.jsx:282-295` — `exportCSV` includes rate columns computed from zeros
- Architecture agent: "Zeroes are semantically indistinguishable from a campaign that genuinely sent zero invites"
- Simplicity agent: "~10 LOC + 2 COLS entries of dead code"

## Proposed Solutions

### Option A: Remove columns entirely (YAGNI, recommended)
Delete `acceptRate` and `replyRate` from `COLS`. Remove `acceptPct`/`replyPct` computation from the row render. Remove rate columns from `exportCSV`. Remove `invitesSent`, `accepted`, `replies` from the API route response entirely (they serve no purpose).

Add them back when `GetCampaignStatsByCampaignId` becomes available.

**Pros:** No misleading data, simpler code. **Cons:** Columns disappear until API is available.

### Option B: Show "N/A" placeholder
Keep the columns but render "N/A" instead of "0 (0%)". Add `statsAvailable: false` to the API response envelope. The UI gates on this flag.

**Pros:** Users see the column structure for when data arrives. **Cons:** More code, still requires Option A cleanup for CSV.

## Recommended Action
Option A — remove the dead columns now, restore when the HeyReach stats endpoint is available.

## Technical Details
- Affected files: `src/app/api/heyreach/campaigns/route.js`, `src/app/heyreach/campaigns/page.jsx`
- Lines to remove from COLS: `acceptRate` (line 24), `replyRate` (line 25)
- Lines to remove from API: `invitesSent: 0, accepted: 0, replies: 0` (lines 54-56)

## Acceptance Criteria
- [ ] No column in the table renders always-zero rate data
- [ ] CSV export does not include rate columns computed from zeros
- [ ] API route does not return `invitesSent`/`accepted`/`replies` fields while they are unavailable

## Work Log
- 2026-04-28: Identified during ce-review by simplicity + architecture agents

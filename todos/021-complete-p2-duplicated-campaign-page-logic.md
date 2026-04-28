---
status: pending
priority: p2
issue_id: "021"
tags: [code-review, architecture, quality]
dependencies: [017]
---

# Cross-device sync logic and table utilities duplicated across both campaign pages

## Problem Statement
Three pieces of logic are byte-for-byte identical between `src/app/campaigns/page.jsx` (SmartLead) and `src/app/heyreach/campaigns/page.jsx` (HeyReach):
1. **Cross-device sync loop** — differs only in `localStorage` key and fetch URL
2. **`N` number formatter component** — renders `0` for falsy values, locale-formatted otherwise
3. **Column pinning** — `pinnedCols` state, `togglePin()`, `stickyStyle()`, `col-pin-btn` markup

Any bug fix or behavior change in these must be applied twice. The sync loop regression (#017) is a direct consequence of this — it was fixed in one place and the fix pattern needs to stay in sync manually.

## Findings
- Pattern-recognition agent: confirmed all three are duplicated verbatim
- `src/app/campaigns/page.jsx` and `src/app/heyreach/campaigns/page.jsx` — both contain identical implementations

## Proposed Solution

### Sync logic → shared utility
`src/lib/syncCampaignIds.js`:
```js
export async function syncCampaignIds({ storageKey, apiPath }) {
  let localIds = [];
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(raw)) localIds = raw;
  } catch {}

  const res = await fetch(apiPath);
  if (!res.ok) return localIds;
  const { ids: serverIds = [] } = await res.json();

  const missing = localIds.filter(id => !serverIds.includes(id));
  await Promise.all(missing.map(id =>
    fetch(apiPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
  ));

  const merged = [...new Set([...serverIds, ...localIds])];
  localStorage.setItem(storageKey, JSON.stringify(merged));
  return merged;
}
```

### N component → shared component
`src/components/NumCell.jsx`:
```jsx
export function NumCell({ v, cls }) {
  if (!v) return <span className="num-zero">0</span>;
  return <span className={cls}>{v.toLocaleString()}</span>;
}
```

### Column pinning → custom hook
`src/hooks/usePinnedColumns.js`:
```js
export function usePinnedColumns(cols) {
  const [pinnedCols, setPinnedCols] = useState(new Set());
  function togglePin(key) {
    setPinnedCols(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function stickyStyle(key) {
    if (!pinnedCols.has(key)) return {};
    let left = 0;
    for (const col of cols) {
      if (col.key === key) break;
      if (pinnedCols.has(col.key)) left += col.w;
    }
    return { position: 'sticky', left, zIndex: 2, background: 'var(--bg-card)' };
  }
  return { pinnedCols, togglePin, stickyStyle };
}
```

## Acceptance Criteria
- [ ] Sync logic exists in one place, both pages import it
- [ ] `N`/`NumCell` exists in one place, both pages import it
- [ ] Column pinning hook exists in one place, both pages use it
- [ ] No behavior change visible to the user

## Work Log
- 2026-04-28: Identified by pattern-recognition agent during ce-review

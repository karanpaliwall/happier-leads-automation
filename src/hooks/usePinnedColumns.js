import { useState } from 'react';

export function usePinnedColumns(cols) {
  const [hoverCol,   setHoverCol]   = useState(null);
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

  return { hoverCol, setHoverCol, pinnedCols, togglePin, stickyStyle };
}

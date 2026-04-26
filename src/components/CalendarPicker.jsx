'use client';
import { useState } from 'react';

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export function fmtCalDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export default function CalendarPicker({ from, to, editField, onSelect, onClear }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const seed = (editField === 'to' && to)   ? new Date(to   + 'T00:00:00')
             : (editField === 'from' && from) ? new Date(from + 'T00:00:00')
             : new Date();
  const [vy, setVy] = useState(seed.getFullYear());
  const [vm, setVm] = useState(seed.getMonth());

  const firstDow = new Date(vy, vm, 1).getDay();
  const dim      = new Date(vy, vm + 1, 0).getDate();

  function iso(d) {
    return `${vy}-${String(vm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function clickDay(d) {
    const s = iso(d);
    if (editField === 'from') {
      const keepTo = to && s <= to ? to : '';
      onSelect(s, keepTo, 'to');
    } else {
      if (!from || s >= from) { onSelect(from || s, s, null); }
      else { onSelect(s, '', 'to'); }
    }
  }

  function clickToday() {
    if (editField === 'from') { onSelect(todayIso, to && to >= todayIso ? to : '', 'to'); }
    else { onSelect(from || todayIso, todayIso, null); }
  }

  function prev() { if (vm === 0) { setVy(y => y - 1); setVm(11); } else setVm(m => m - 1); }
  function next() { if (vm === 11) { setVy(y => y + 1); setVm(0);  } else setVm(m => m + 1); }

  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];

  return (
    <div className="cal-popover">
      <div className="cal-editing-hint">
        {editField === 'from' ? 'Select start date' : 'Select end date'}
      </div>
      <div className="cal-nav-row">
        <span className="cal-month-title">{CAL_MONTHS[vm]}, {vy}
          <svg style={{ marginLeft: 4, verticalAlign: 'middle', opacity: 0.5 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" className="cal-nav-btn" onClick={prev}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button type="button" className="cal-nav-btn" onClick={next}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>
      <div className="cal-grid">
        {CAL_DAYS.map(dl => <div key={dl} className="cal-dow">{dl}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const s      = iso(d);
          const sel    = s === from || s === to;
          const inRange = from && to && s > from && s < to;
          const isToday = s === todayIso;
          return (
            <button
              key={d}
              type="button"
              className={`cal-day${sel ? ' cal-sel' : isToday ? ' cal-today' : ''}${inRange ? ' cal-range' : ''}`}
              onClick={() => clickDay(d)}
            >{d}</button>
          );
        })}
      </div>
      <div className="cal-footer-row">
        <button type="button" className="cal-foot-btn" onClick={onClear}>Clear</button>
        <button type="button" className="cal-foot-btn cal-foot-today" onClick={clickToday}>Today</button>
      </div>
    </div>
  );
}

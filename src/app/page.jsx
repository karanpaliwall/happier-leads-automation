'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import EmptyState from '@/components/EmptyState';

const DEFAULT_STATS = { total: 0, newToday: 0, exact: 0, suggested: 0, newTodayExact: 0, newTodaySuggested: 0 };
let _cache = { stats: DEFAULT_STATS, lastReceived: null };

function fmtAxisDate(iso, granularity) {
  const d = new Date(iso);
  if (granularity === 'hour') {
    // Relative labels so the axis always reads left→right in clear order.
    // Absolute times (11 PM → 3 AM) confuse users when the window crosses midnight.
    const hoursAgo = Math.round((Date.now() - d.getTime()) / 3600000);
    if (hoursAgo <= 0) return 'now';
    return `−${hoursAgo}h`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function fmtTooltipDate(iso, granularity) {
  const d = new Date(iso);
  if (granularity === 'hour') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', hour12: true, timeZone: 'UTC' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function fmtDate(iso) {
  if (!iso) return 'No leads yet';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShortRange(fromIso, toIso) {
  const from = new Date(fromIso + 'T00:00:00Z');
  const to   = new Date(toIso   + 'T00:00:00Z');
  const sameMonth = from.getUTCMonth() === to.getUTCMonth();
  const fmtFrom = from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const fmtTo   = sameMonth
    ? to.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' })
    : to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmtFrom}–${fmtTo}`;
}

function getRangeParams(range, from, to) {
  if (range === 'custom') return { since: null, dateFrom: from, dateTo: to };
  if (range === '24h') {
    return { since: new Date(Date.now() - 86400000).toISOString(), dateFrom: null, dateTo: null };
  }
  if (range === '7d') {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return { since: null, dateFrom: d.toISOString().slice(0, 10), dateTo: null };
  }
  return { since: null, dateFrom: null, dateTo: null }; // 'all'
}

function getComparePeriod(range, from, to) {
  if (range === 'all' || range === '24h') return null;
  if (range === '7d') {
    const compTo   = new Date(); compTo.setDate(compTo.getDate() - 7);
    const compFrom = new Date(); compFrom.setDate(compFrom.getDate() - 13);
    return { dateFrom: compFrom.toISOString().slice(0, 10), dateTo: compTo.toISOString().slice(0, 10) };
  }
  if (range === 'custom' && from && to) {
    const fromD    = new Date(from + 'T00:00:00Z');
    const toD      = new Date(to   + 'T00:00:00Z');
    const diffDays = Math.round((toD - fromD) / 86400000);
    const compToD  = new Date(fromD.getTime() - 86400000);
    const compFromD = new Date(compToD.getTime() - diffDays * 86400000);
    return { dateFrom: compFromD.toISOString().slice(0, 10), dateTo: compToD.toISOString().slice(0, 10) };
  }
  return null;
}

// ── Chart helpers ───────────────────────────────────────────────────────────
const CM = { top: 12, right: 16, bottom: 32, left: 42 };
const CVW = 600, CVH = 240;
const CPW = CVW - CM.left - CM.right;
const CPH = CVH - CM.top - CM.bottom;

function fillGaps(pts, fromIso, toIso) {
  if (!pts.length && !fromIso) return pts;
  const map = Object.fromEntries(pts.map(p => [p.date, p]));
  const start = fromIso ? new Date(fromIso + 'T00:00:00Z') : new Date(pts[0].date + 'T00:00:00Z');
  const end   = toIso   ? new Date(toIso   + 'T00:00:00Z') : new Date(pts[pts.length - 1].date + 'T00:00:00Z');
  const out   = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    out.push(map[k] ?? { date: k, total: 0, exact: 0, suggested: 0 });
  }
  return out;
}

function fillHourGaps(pts) {
  const now   = Date.now();
  const nowH  = now - (now % 3600000);        // floor to current UTC hour
  const startH = nowH - 23 * 3600000;         // 24 buckets: 23h ago → now

  const map = {};
  pts.forEach(p => {
    const t = new Date(p.date).getTime();
    map[t - (t % 3600000)] = p;               // normalize key to hour start
  });

  const out = [];
  for (let t = startH; t <= nowH; t += 3600000) {
    out.push(map[t] ?? { date: new Date(t).toISOString(), total: 0, exact: 0, suggested: 0 });
  }
  return out;
}

function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'help', flexShrink: 0, opacity: 0.55 }}>
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      {show && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1e293b',
          border: '1px solid rgba(148,163,184,0.15)',
          borderRadius: 6,
          padding: '7px 11px',
          fontSize: 11,
          lineHeight: 1.5,
          color: 'rgba(148,163,184,0.9)',
          whiteSpace: 'normal',
          maxWidth: 230,
          width: 'max-content',
          zIndex: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          textAlign: 'center',
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

function smoothPath(pts2d) {
  if (!pts2d.length) return '';
  if (pts2d.length === 1) return `M ${pts2d[0][0]} ${pts2d[0][1]}`;
  let d = `M ${pts2d[0][0]} ${pts2d[0][1]}`;
  for (let i = 0; i < pts2d.length - 1; i++) {
    const [x0, y0] = pts2d[i];
    const [x1, y1] = pts2d[i + 1];
    const mx = (x0 + x1) / 2;
    d += ` C ${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
  }
  return d;
}

// ── LeadsChart ──────────────────────────────────────────────────────────────
function LeadsChart({ rawPoints, granularity, loading, mainFrom, mainTo }) {
  const svgRef   = useRef(null);
  const outerRef = useRef(null);
  const [clipW,    setClipW]    = useState(0);
  const [hoverIdx, setHoverIdx] = useState(null);
  // localCVH: target ~220px rendered height on narrow containers; CVH on wide ones.
  // ResizeObserver fires after first paint and keeps it live on resize.
  const [localCVH,      setLocalCVH]      = useState(CVH);
  const [localFontSize, setLocalFontSize] = useState(9);

  useEffect(() => {
    if (!outerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      if (w > 0 && w < 520) {
        setLocalCVH(Math.round(220 * CVW / w));
        // Target ~11px rendered; font in SVG coords = 11 * (CVW / w)
        setLocalFontSize(Math.round(11 * CVW / w));
      } else {
        setLocalCVH(CVH);
        setLocalFontSize(9);
      }
    });
    ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, []);

  const localCPH = localCVH - CM.top - CM.bottom;

  const points = useMemo(
    () => granularity === 'day' ? fillGaps(rawPoints ?? [], mainFrom, mainTo) : fillHourGaps(rawPoints ?? []),
    [rawPoints, granularity, mainFrom, mainTo]
  );

  useEffect(() => {
    if (!points.length) return;
    setClipW(0);
    setHoverIdx(null);
    let start = null;
    const go = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1100, 1);
      setClipW((1 - (1 - p) ** 3) * CPW);
      if (p < 1) requestAnimationFrame(go);
    };
    const raf = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf);
  }, [points]);

  if (loading) {
    return (
      <div ref={outerRef} style={{ height: 180, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
        <div className="skeleton-row" style={{ width: '100%', height: 120, borderRadius: 8 }} />
      </div>
    );
  }

  if (!points.length) {
    return (
      <div ref={outerRef} style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No lead data for this period
      </div>
    );
  }

  const maxVal = Math.max(...points.map(p => Math.max(p.exact, p.suggested)), 1);
  const yMax   = Math.max(Math.ceil(maxVal / 5) * 5, 5);

  const xP = (i) => CM.left + (points.length > 1 ? (i / (points.length - 1)) * CPW : CPW / 2);
  const yP = (v) => CM.top + localCPH - (v / yMax) * localCPH;

  const coords = (key) => points.map((p, i) => [xP(i), yP(p[key])]);

  const areaPath = (key) => {
    const c = coords(key);
    return `${smoothPath(c)} L ${xP(points.length - 1)} ${yP(0)} L ${xP(0)} ${yP(0)} Z`;
  };

  const yTicks = [0, Math.round(yMax / 4), Math.round(yMax / 2), Math.round(3 * yMax / 4), yMax];

  const tickCount = Math.min(7, points.length);
  const xTicks = tickCount < 2
    ? [0]
    : Array.from({ length: tickCount }, (_, i) =>
        Math.round(i * (points.length - 1) / (tickCount - 1))
      );

  const handleMove = (e) => {
    if (!svgRef.current || points.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX  = (e.clientX - rect.left) * (CVW / rect.width);
    const frac  = (svgX - CM.left) / CPW;
    setHoverIdx(Math.max(0, Math.min(points.length - 1, Math.round(frac * (points.length - 1)))));
  };

  const hp = hoverIdx !== null ? points[hoverIdx] : null;
  const hx = hoverIdx !== null ? xP(hoverIdx) : null;

  return (
    <div ref={outerRef} className="chart-outer" onMouseLeave={() => setHoverIdx(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${CVW} ${localCVH}`} className="chart-svg" onMouseMove={handleMove}>
        <defs>
          <clipPath id="chart-clip">
            <rect x={CM.left} y={0} width={clipW} height={localCVH} />
          </clipPath>
          <linearGradient id="cg-exact" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="cg-sug" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid + Y labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={CM.left} y1={yP(t)} x2={CM.left + CPW} y2={yP(t)}
              stroke="rgba(255,255,255,0.055)" strokeWidth="1"
            />
            <text x={CM.left - 6} y={yP(t) + 4} textAnchor="end"
              style={{ fontSize: localFontSize, fill: 'rgba(148,163,184,0.65)', fontFamily: 'inherit' }}>
              {t}
            </text>
          </g>
        ))}

        {/* X labels */}
        {xTicks.map(idx => (
          <text key={idx} x={xP(idx)} y={localCVH - 5} textAnchor="middle"
            style={{ fontSize: localFontSize, fill: 'rgba(148,163,184,0.65)', fontFamily: 'inherit' }}>
            {fmtAxisDate(points[idx].date, granularity)}
          </text>
        ))}

        {/* Animated areas + lines */}
        <g clipPath="url(#chart-clip)">
          <path d={areaPath('exact')}     fill="url(#cg-exact)" />
          <path d={areaPath('suggested')} fill="url(#cg-sug)" />
          <path d={smoothPath(coords('exact'))}     fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinejoin="round" />
          <path d={smoothPath(coords('suggested'))} fill="none" stroke="#fb923c" strokeWidth="1.8" strokeLinejoin="round" />
        </g>

        {/* Hover crosshair + dots */}
        {hp && (
          <>
            <line x1={hx} y1={CM.top} x2={hx} y2={CM.top + localCPH}
              stroke="rgba(148,163,184,0.35)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hx} cy={yP(hp.exact)}     r="3.5" fill="#4ade80" />
            <circle cx={hx} cy={yP(hp.suggested)} r="3.5" fill="#fb923c" />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hp && (
        <div
          className="chart-tooltip"
          style={{
            left: `calc(${(hx / CVW) * 100}% + 10px)`,
            transform: (hx / CVW) > 0.68 ? 'translateX(calc(-100% - 20px))' : 'none',
          }}
        >
          <div className="chart-tip-date">{fmtTooltipDate(hp.date, granularity)}</div>
          <div className="chart-tip-row" style={{ color: '#4ade80' }}>Exact · {hp.exact}</div>
          <div className="chart-tip-row" style={{ color: '#fb923c' }}>Suggested · {hp.suggested}</div>
        </div>
      )}

      {/* Legend */}
      <div className="chart-legend">
        <span className="chart-leg"><span className="chart-leg-dot" style={{ background: '#4ade80' }} />Exact</span>
        <span className="chart-leg"><span className="chart-leg-dot" style={{ background: '#fb923c' }} />Suggested</span>
      </div>
    </div>
  );
}

// ── Calendar picker (shared with Leads page) ────────────────────────────────
const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function fmtCalDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function CalendarPicker({ from, to, editField, onSelect, onClear }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const seed = (editField === 'to' && to) ? new Date(to + 'T00:00:00')
             : (editField === 'from' && from) ? new Date(from + 'T00:00:00')
             : new Date();
  const [vy, setVy] = useState(seed.getFullYear());
  const [vm, setVm] = useState(seed.getMonth());

  const firstDow = new Date(vy, vm, 1).getDay();
  const dim = new Date(vy, vm + 1, 0).getDate();

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
  function next() { if (vm === 11) { setVy(y => y + 1); setVm(0); } else setVm(m => m + 1); }

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
          <button className="cal-nav-btn" onClick={prev}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button className="cal-nav-btn" onClick={next}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>
      <div className="cal-grid">
        {CAL_DAYS.map(dl => <div key={dl} className="cal-dow">{dl}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const s = iso(d);
          const sel = s === from || s === to;
          const inRange = from && to && s > from && s < to;
          const isToday = s === todayIso;
          return (
            <button
              key={d}
              className={`cal-day${sel ? ' cal-sel' : isToday ? ' cal-today' : ''}${inRange ? ' cal-range' : ''}`}
              onClick={() => clickDay(d)}
            >{d}</button>
          );
        })}
      </div>
      <div className="cal-footer-row">
        <button className="cal-foot-btn" onClick={onClear}>Clear</button>
        <button className="cal-foot-btn cal-foot-today" onClick={clickToday}>Today</button>
      </div>
    </div>
  );
}

// ── Chart date-range filter ─────────────────────────────────────────────────
const PRESETS = [
  { key: '24h', label: 'Past 24 hours' },
  { key: '7d',  label: 'Past 7 days' },
  { key: 'all', label: 'All time' },
];

function ChartFilter({ range, from, to, onChange, cmpLabel }) {
  const [open, setOpen]               = useState(false);
  const [calEditField, setCalEditField] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setCalEditField(null);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const label = PRESETS.find(p => p.key === range)?.label ?? 'Custom range';

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button className="chart-filter-btn" onClick={() => { setOpen(o => !o); setCalEditField(null); }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>{label}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && !calEditField && (
        <div className="chart-filter-popover">
          <div className="chart-filter-sep" style={{ marginTop: 0 }}>After (current period)</div>
          {PRESETS.map(({ key, label: pl }) => (
            <button
              key={key}
              className={`chart-filter-opt${range === key ? ' active' : ''}`}
              onClick={() => { onChange(key, '', ''); setOpen(false); }}
            >{pl}</button>
          ))}
          <div className="chart-filter-sep">Custom</div>
          <div className="chart-filter-custom">
            <div className="cal-range-trigger">
              <button
                className={`cal-field-btn${range === 'custom' && from ? ' cal-field-active' : ''}`}
                onClick={() => setCalEditField('from')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span className={from ? 'cal-val' : 'cal-placeholder'}>{from ? fmtCalDate(from) : 'dd-mm-yyyy'}</span>
              </button>
              <span className="cal-sep">—</span>
              <button
                className={`cal-field-btn${range === 'custom' && to ? ' cal-field-active' : ''}`}
                onClick={() => setCalEditField('to')}
              >
                <span className={to ? 'cal-val' : 'cal-placeholder'}>{to ? fmtCalDate(to) : 'dd-mm-yyyy'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </button>
            </div>
          </div>
          {cmpLabel && (
            <>
              <div className="chart-filter-sep">Before (previous period)</div>
              <div style={{ padding: '5px 10px 8px', fontSize: 12, color: 'var(--text-muted)' }}>
                {cmpLabel.replace('vs ', '')}
                <span style={{ opacity: 0.45, marginLeft: 5 }}>· auto</span>
              </div>
            </>
          )}
        </div>
      )}

      {calEditField && (
        <CalendarPicker
          from={from}
          to={to}
          editField={calEditField}
          onSelect={(f, t, next) => {
            onChange('custom', f, t);
            setCalEditField(next);
            if (!next) setOpen(false);
          }}
          onClear={() => { onChange('custom', '', ''); setCalEditField(null); setOpen(false); }}
        />
      )}
    </div>
  );
}

// ── StatCard ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, accent, icon, sub }) {
  return (
    <div className="stat-card-v2" style={{ borderTopColor: accent }}>
      <div className="stat-card-v2-top">
        <span className="stat-card-v2-label">{label}</span>
        <span className="stat-card-v2-icon" style={{ color: accent }}>{icon}</span>
      </div>
      <div className="stat-card-v2-value" style={{ color }}>{value}</div>
      {sub}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [stats,        setStats]       = useState(_cache.stats);
  const [loading,      setLoading]     = useState(_cache.stats.total === 0);
  const [lastReceived, setLastReceived]= useState(_cache.lastReceived);

  const [chartRange,       setChartRange]       = useState('7d');
  const [chartFrom,        setChartFrom]        = useState('');
  const [chartTo,          setChartTo]          = useState('');
  const [chartPoints,      setChartPoints]      = useState([]);
  const [chartGranularity, setChartGranularity] = useState('day');
  const [chartLoading,     setChartLoading]     = useState(true);
  const [compareRaw,       setCompareRaw]       = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch('/api/leads?limit=1');
      const data = await res.json();
      _cache = {
        stats:        data.stats ?? DEFAULT_STATS,
        lastReceived: data.leads?.[0]?.received_at ?? null,
      };
      setStats(_cache.stats);
      setLastReceived(_cache.lastReceived);
    } catch (err) { console.error('Failed to fetch:', err); }
    finally { setLoading(false); }
  }, []);

  const fetchChart = useCallback(async () => {
    const { since, dateFrom, dateTo } = getRangeParams(chartRange, chartFrom, chartTo);
    const params = new URLSearchParams();
    if (since)    params.set('since', since);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo)   params.set('dateTo', dateTo);
    setChartLoading(true);
    const cmp = getComparePeriod(chartRange, chartFrom, chartTo);
    const cmpParams = cmp ? new URLSearchParams({ dateFrom: cmp.dateFrom, dateTo: cmp.dateTo }) : null;
    try {
      const [res, cres] = await Promise.all([
        fetch(`/api/leads/chart?${params}`),
        cmpParams ? fetch(`/api/leads/chart?${cmpParams}`) : Promise.resolve(null),
      ]);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setChartPoints(data.points ?? []);
      setChartGranularity(data.granularity ?? 'day');
      if (cres) {
        const cdata = await cres.json();
        setCompareRaw(cdata.points ?? []);
      } else {
        setCompareRaw([]);
      }
    } catch (e) { console.error('chart fetch:', e); setCompareRaw([]); }
    finally { setChartLoading(false); }
  }, [chartRange, chartFrom, chartTo]);

  const mainBounds = useMemo(() => {
    if (chartRange === 'all' || chartRange === '24h') return null;
    if (chartRange === '7d') {
      const today = new Date();
      const from  = new Date(); from.setDate(from.getDate() - 6);
      return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
    }
    if (chartRange === 'custom' && chartFrom && chartTo) return { from: chartFrom, to: chartTo };
    return null;
  }, [chartRange, chartFrom, chartTo]);

  const cmpBounds = useMemo(() => getComparePeriod(chartRange, chartFrom, chartTo), [chartRange, chartFrom, chartTo]);

  const compareLabel = useMemo(() => {
    if (!cmpBounds?.dateFrom || !cmpBounds?.dateTo) return null;
    return `vs ${fmtCalDate(cmpBounds.dateFrom)} – ${fmtCalDate(cmpBounds.dateTo)}`;
  }, [cmpBounds]);

  const chartSummary = useMemo(() => {
    if (!cmpBounds || chartLoading) return null;
    const afterExact  = chartPoints.reduce((s, p) => s + p.exact, 0);
    const afterSug    = chartPoints.reduce((s, p) => s + p.suggested, 0);
    const beforeExact = compareRaw.reduce((s, p) => s + p.exact, 0);
    const beforeSug   = compareRaw.reduce((s, p) => s + p.suggested, 0);
    const afterTotal  = afterExact + afterSug;
    const beforeTotal = beforeExact + beforeSug;
    const pct = beforeTotal === 0 ? null : Math.round(((afterTotal - beforeTotal) / beforeTotal) * 100);
    return { afterExact, afterSug, beforeExact, beforeSug, afterTotal, beforeTotal, pct };
  }, [chartPoints, compareRaw, cmpBounds, chartLoading]);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 10000); return () => clearInterval(iv); }, [fetchData]);
  useEffect(() => { fetchChart(); }, [fetchChart]);

  const handleRangeChange = (range, from, to) => {
    setChartRange(range);
    setChartFrom(from);
    setChartTo(to);
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle">Live lead stats, pipeline health &amp; activity analytics · auto-refreshes every 10s</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        {!loading && stats.total === 0 && <EmptyState />}

        {(loading || stats.total > 0) && (
          <>
            {/* Stat cards */}
            <div className="stat-grid-v2">
              <StatCard
                label="Total Leads" value={stats.total}
                color="var(--text-primary)" accent="var(--blue-500)"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                }
              />
              <StatCard
                label="New Today" value={stats.newToday}
                color="var(--blue-400)" accent="var(--blue-400)"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                }
                sub={(stats.newTodayExact > 0 || stats.newTodaySuggested > 0) ? (
                  <div className="stat-card-breakdown">
                    <span style={{ color: 'var(--green-400)' }}>{stats.newTodayExact} Exact</span>
                    <span style={{ color: 'var(--text-muted)' }}>/</span>
                    <span style={{ color: 'var(--orange-400)' }}>{stats.newTodaySuggested} Suggested</span>
                  </div>
                ) : null}
              />
              <StatCard
                label="Exact Leads" value={stats.exact}
                color="var(--green-400)" accent="var(--green-400)"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                }
              />
              <StatCard
                label="Suggested" value={stats.suggested}
                color="var(--orange-400)" accent="var(--orange-400)"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                }
              />
            </div>

            {/* Pipeline Status + Lead Activity chart */}
            <div className="overview-grid">
              <div className="card overview-status-card">
                <div className="card-header">
                  <h3 className="card-title">Pipeline Status</h3>
                </div>
                <div className="status-rows">
                  <div className="status-row">
                    <span className="dot-green" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Webhook Active</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>POST /api/webhook/happierleads</div>
                    </div>
                  </div>
                  <div className="status-row">
                    <span className="dot-green" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Database Connected</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Neon PostgreSQL · {stats.total} leads stored</div>
                    </div>
                  </div>
                  <div className="status-row">
                    <span className="dot-green" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Last Lead Received</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {fmtDate(lastReceived)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card overview-chart-card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Analytics</h3>
                    <p className="chart-subtitle">Daily leads received</p>
                  </div>
                  <ChartFilter
                    range={chartRange} from={chartFrom} to={chartTo}
                    onChange={handleRangeChange}
                    cmpLabel={compareLabel}
                  />
                </div>
                <LeadsChart
                  rawPoints={chartPoints}
                  granularity={chartGranularity}
                  loading={chartLoading}
                  mainFrom={mainBounds?.from ?? null}
                  mainTo={mainBounds?.to ?? null}
                />
                {chartSummary && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px 10px', fontSize: 12, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', opacity: 0.7 }}>
                      Prev. period ({fmtShortRange(cmpBounds.dateFrom, cmpBounds.dateTo)})
                      <InfoTooltip text="The same-length period immediately before the current range, used to compare how leads have changed" />
                      :
                    </span>
                    <span style={{ color: '#4ade80' }}>{chartSummary.beforeExact} Exact</span>
                    <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>·</span>
                    <span style={{ color: '#fb923c' }}>{chartSummary.beforeSug} Suggested</span>
                    <span style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 2px' }}>→</span>
                    <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                      Current ({fmtShortRange(mainBounds.from, mainBounds.to)}):
                    </span>
                    <span style={{ color: '#4ade80' }}>{chartSummary.afterExact} Exact</span>
                    <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>·</span>
                    <span style={{ color: '#fb923c' }}>{chartSummary.afterSug} Suggested</span>
                    {chartSummary.pct !== null && (
                      <span style={{ fontWeight: 600, color: chartSummary.pct >= 0 ? 'var(--green-400)' : '#f87171' }}>
                        {chartSummary.pct >= 0 ? '↑' : '↓'}{Math.abs(chartSummary.pct)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

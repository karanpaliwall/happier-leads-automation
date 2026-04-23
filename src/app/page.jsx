'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import EmptyState from '@/components/EmptyState';

const DEFAULT_STATS = { total: 0, newToday: 0, exact: 0, suggested: 0, newTodayExact: 0, newTodaySuggested: 0 };
let _cache = { leads: [], stats: DEFAULT_STATS, lastReceived: null };

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function fmtAxisDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function fmtTooltipDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function getRangeParams(range, from, to) {
  if (range === 'custom') return { dateFrom: from, dateTo: to };
  if (range === 'all')    return { dateFrom: '', dateTo: '' };
  const days = { '7d': 6, '14d': 13, '30d': 29, '90d': 89 }[range] ?? 29;
  const d = new Date(); d.setDate(d.getDate() - days);
  return { dateFrom: d.toISOString().slice(0, 10), dateTo: '' };
}

// ── Chart helpers ───────────────────────────────────────────────────────────
const CM = { top: 12, right: 16, bottom: 32, left: 42 };
const CVW = 600, CVH = 180;
const CPW = CVW - CM.left - CM.right;
const CPH = CVH - CM.top - CM.bottom;

function fillGaps(pts) {
  if (!pts.length) return pts;
  const map = Object.fromEntries(pts.map(p => [p.date, p]));
  const start = new Date(pts[0].date + 'T00:00:00Z');
  const end   = new Date(pts[pts.length - 1].date + 'T00:00:00Z');
  const out   = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    out.push(map[k] ?? { date: k, total: 0, exact: 0, suggested: 0 });
  }
  return out;
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
function LeadsChart({ rawPoints, loading }) {
  const svgRef   = useRef(null);
  const [clipW,    setClipW]    = useState(0);
  const [hoverIdx, setHoverIdx] = useState(null);

  const points = useMemo(() => fillGaps(rawPoints ?? []), [rawPoints]);

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
      <div style={{ height: 180, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
        <div className="skeleton-row" style={{ width: '100%', height: 120, borderRadius: 8 }} />
      </div>
    );
  }

  if (!points.length) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No lead data for this period
      </div>
    );
  }

  const maxVal = Math.max(...points.map(p => p.total), 1);
  const yMax   = Math.max(Math.ceil(maxVal / 5) * 5, 5);

  const xP = (i) => CM.left + (points.length > 1 ? (i / (points.length - 1)) * CPW : CPW / 2);
  const yP = (v) => CM.top + CPH - (v / yMax) * CPH;

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
    <div className="chart-outer" onMouseLeave={() => setHoverIdx(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${CVW} ${CVH}`} className="chart-svg" onMouseMove={handleMove}>
        <defs>
          <clipPath id="chart-clip">
            <rect x={CM.left} y={0} width={clipW} height={CVH} />
          </clipPath>
          <linearGradient id="cg-total" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.02" />
          </linearGradient>
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
              style={{ fontSize: 9, fill: 'rgba(148,163,184,0.65)', fontFamily: 'inherit' }}>
              {t}
            </text>
          </g>
        ))}

        {/* X labels */}
        {xTicks.map(idx => (
          <text key={idx} x={xP(idx)} y={CVH - 5} textAnchor="middle"
            style={{ fontSize: 9, fill: 'rgba(148,163,184,0.65)', fontFamily: 'inherit' }}>
            {fmtAxisDate(points[idx].date)}
          </text>
        ))}

        {/* Animated areas + lines */}
        <g clipPath="url(#chart-clip)">
          <path d={areaPath('total')}     fill="url(#cg-total)" />
          <path d={areaPath('exact')}     fill="url(#cg-exact)" />
          <path d={areaPath('suggested')} fill="url(#cg-sug)" />
          <path d={smoothPath(coords('total'))}     fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinejoin="round" />
          <path d={smoothPath(coords('exact'))}     fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinejoin="round" />
          <path d={smoothPath(coords('suggested'))} fill="none" stroke="#fb923c" strokeWidth="1.8" strokeLinejoin="round" />
        </g>

        {/* Hover crosshair + dots */}
        {hp && (
          <>
            <line x1={hx} y1={CM.top} x2={hx} y2={CM.top + CPH}
              stroke="rgba(148,163,184,0.35)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hx} cy={yP(hp.total)}     r="3.5" fill="#60a5fa" />
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
          <div className="chart-tip-date">{fmtTooltipDate(hp.date)}</div>
          <div className="chart-tip-row" style={{ color: '#60a5fa' }}>Total · {hp.total}</div>
          <div className="chart-tip-row" style={{ color: '#4ade80' }}>Exact · {hp.exact}</div>
          <div className="chart-tip-row" style={{ color: '#fb923c' }}>Suggested · {hp.suggested}</div>
        </div>
      )}

      {/* Legend */}
      <div className="chart-legend">
        <span className="chart-leg"><span className="chart-leg-dot" style={{ background: '#60a5fa' }} />Total</span>
        <span className="chart-leg"><span className="chart-leg-dot" style={{ background: '#4ade80' }} />Exact</span>
        <span className="chart-leg"><span className="chart-leg-dot" style={{ background: '#fb923c' }} />Suggested</span>
      </div>
    </div>
  );
}

// ── Chart date-range filter ─────────────────────────────────────────────────
const PRESETS = [
  { key: '7d',  label: 'Last 7 days' },
  { key: '14d', label: 'Last 14 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'all', label: 'All time' },
];

function ChartFilter({ range, from, to, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const label = PRESETS.find(p => p.key === range)?.label ?? 'Custom range';

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button className="chart-filter-btn" onClick={() => setOpen(o => !o)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>{label}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="chart-filter-popover">
          {PRESETS.map(({ key, label: pl }) => (
            <button
              key={key}
              className={`chart-filter-opt${range === key ? ' active' : ''}`}
              onClick={() => { onChange(key, '', ''); setOpen(false); }}
            >{pl}</button>
          ))}
          <div className="chart-filter-sep">Custom Range</div>
          <div className="chart-filter-custom">
            <input
              type="date"
              className="chart-date-input"
              value={from}
              onChange={e => onChange('custom', e.target.value, to)}
            />
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>–</span>
            <input
              type="date"
              className="chart-date-input"
              value={to}
              onChange={e => onChange('custom', from, e.target.value)}
            />
          </div>
        </div>
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
  const [leads,       setLeads]       = useState(_cache.leads);
  const [stats,       setStats]       = useState(_cache.stats);
  const [loading,     setLoading]     = useState(_cache.leads.length === 0);
  const [lastReceived,setLastReceived]= useState(_cache.lastReceived);

  const [chartRange,   setChartRange]   = useState('30d');
  const [chartFrom,    setChartFrom]    = useState('');
  const [chartTo,      setChartTo]      = useState('');
  const [chartPoints,  setChartPoints]  = useState([]);
  const [chartLoading, setChartLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch('/api/leads?limit=5');
      const data = await res.json();
      _cache = {
        leads:        data.leads ?? [],
        stats:        data.stats ?? DEFAULT_STATS,
        lastReceived: data.leads?.[0]?.received_at ?? null,
      };
      setLeads(_cache.leads);
      setStats(_cache.stats);
      setLastReceived(_cache.lastReceived);
    } catch (err) { console.error('Failed to fetch:', err); }
    finally { setLoading(false); }
  }, []);

  const fetchChart = useCallback(async () => {
    const { dateFrom, dateTo } = getRangeParams(chartRange, chartFrom, chartTo);
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo)   params.set('dateTo', dateTo);
    setChartLoading(true);
    try {
      const res  = await fetch(`/api/leads/chart?${params}`);
      const data = await res.json();
      setChartPoints(data.points ?? []);
    } catch (e) { console.error(e); }
    finally { setChartLoading(false); }
  }, [chartRange, chartFrom, chartTo]);

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
            <p className="page-subtitle">Pipeline health and recent lead activity · auto-refreshes every 10s</p>
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

            {/* Lead activity chart */}
            <div className="card overview-chart-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Lead Activity</h3>
                  <p className="chart-subtitle">Daily leads received</p>
                </div>
                <ChartFilter
                  range={chartRange} from={chartFrom} to={chartTo}
                  onChange={handleRangeChange}
                />
              </div>
              <LeadsChart rawPoints={chartPoints} loading={chartLoading} />
            </div>

            {/* Pipeline + Recent leads */}
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
                        {lastReceived ? fmtTooltipDate(lastReceived) : 'No leads yet'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card overview-recent-card">
                <div className="card-header">
                  <h3 className="card-title">Recent Leads</h3>
                  <Link href="/filtered" className="card-link">View all →</Link>
                </div>
                {loading ? (
                  <div className="skeleton-list">
                    {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
                  </div>
                ) : leads.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No leads yet — waiting for first visitor
                  </div>
                ) : (
                  <div className="recent-leads-list">
                    {leads.map(lead => (
                      <div key={lead.id} className="recent-lead-row">
                        <div className="person-cell">
                          <div className="avatar-initials">{getInitials(lead.full_name)}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                              {lead.full_name || '—'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {lead.company_name || '—'}
                            </div>
                          </div>
                        </div>
                        {lead.lead_type && (
                          <span className={`badge badge-${lead.lead_type}`}>
                            {lead.lead_type.charAt(0).toUpperCase() + lead.lead_type.slice(1)}
                          </span>
                        )}
                      </div>
                    ))}
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

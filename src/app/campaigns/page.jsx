'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import CalendarPicker, { fmtCalDate } from '@/components/CalendarPicker';

const STATUS_OPTS = [
  { label: 'All Status', value: 'all'       },
  { label: 'Active',     value: 'ACTIVE'    },
  { label: 'Paused',     value: 'PAUSED'    },
  { label: 'Completed',  value: 'COMPLETED' },
  { label: 'Finished',   value: 'FINISHED'  },
  { label: 'Draft',      value: 'DRAFT'     },
];

const STATUS_PILLS = [
  { label: 'All',      value: 'all',      color: 'var(--blue-400)', bg: 'rgba(59,130,246,0.13)'  },
  { label: 'Active',   value: 'ACTIVE',   color: '#4ade80',         bg: 'rgba(74,222,128,0.12)'  },
  { label: 'Paused',   value: 'PAUSED',   color: '#facc15',         bg: 'rgba(234,179,8,0.13)'   },
  { label: 'Finished', value: 'FINISHED', color: '#60a5fa',         bg: 'rgba(59,130,246,0.12)'  },
  { label: 'Draft',    value: 'DRAFT',    color: '#9ca3af',         bg: 'rgba(107,114,128,0.13)' },
];

const STATUS_COLORS = {
  ACTIVE:    '#4ade80',
  PAUSED:    '#facc15',
  FINISHED:  '#60a5fa',
  COMPLETED: '#60a5fa',
  DRAFT:     '#9ca3af',
  FAILED:    '#f87171',
  ARCHIVED:  '#9ca3af',
};

// ── SVG arc helpers ──────────────────────────────────────────────────────────
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx, cy, outerR, innerR, startDeg, endDeg) {
  const [ox1, oy1] = polar(cx, cy, outerR, startDeg);
  const [ox2, oy2] = polar(cx, cy, outerR, endDeg);
  const [ix1, iy1] = polar(cx, cy, innerR, startDeg);
  const [ix2, iy2] = polar(cx, cy, innerR, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`;
}

// ── Charts ───────────────────────────────────────────────────────────────────
function BarChart({ campaigns }) {
  if (!campaigns.length || !campaigns.some(c => c.totalLeads > 0)) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '20px 0', textAlign: 'center' }}>No lead data available yet</p>;
  }
  const top = [...campaigns].sort((a, b) => (b.totalLeads || 0) - (a.totalLeads || 0)).slice(0, 10);
  const maxVal = Math.max(...top.map(c => c.totalLeads || 0), 1);
  const ROW_H = 38, BAR_H = 20, NAME_W = 145, PAD_L = 8, PAD_R = 12, TICK_H = 28;
  const VB_W = 530;
  const BAR_W = VB_W - NAME_W - PAD_L - PAD_R;
  const VB_H = top.length * ROW_H + TICK_H;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {ticks.map((t, i) => {
        const x = NAME_W + PAD_L + (t / maxVal) * BAR_W;
        return (
          <g key={i}>
            <line x1={x} y1={0} x2={x} y2={VB_H - TICK_H} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={x} y={VB_H - 6} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.35)">
              {t >= 1000 ? `${(t / 1000).toFixed(t % 1000 === 0 ? 0 : 1)}k` : t}
            </text>
          </g>
        );
      })}
      {top.map((c, i) => {
        const barW = Math.max((c.totalLeads / maxVal) * BAR_W, 2);
        const y = i * ROW_H;
        const label = c.name.length > 21 ? c.name.slice(0, 20) + '…' : c.name;
        return (
          <g key={c.id}>
            <text x={NAME_W - 6} y={y + ROW_H / 2 + 4} textAnchor="end" fontSize={11} fill="rgba(255,255,255,0.65)">
              {label}
            </text>
            <rect x={NAME_W + PAD_L} y={y + (ROW_H - BAR_H) / 2} width={barW} height={BAR_H} rx={3} fill="rgba(59,130,246,0.75)" />
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ campaigns }) {
  const total = campaigns.length;
  if (!total) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data</p>;

  const counts = campaigns.reduce((acc, c) => {
    const s = c.status || 'UNKNOWN';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const segs = Object.entries(counts)
    .map(([s, n]) => ({ status: s, count: n, color: STATUS_COLORS[s] || '#9ca3af' }))
    .sort((a, b) => b.count - a.count);

  const CX = 90, CY = 90, OR = 72, IR = 52;
  let angle = -90;
  const arcs = segs.map(seg => {
    const start = angle;
    const sweep = Math.min((seg.count / total) * 360, 359.9);
    angle += sweep;
    return { ...seg, start, end: start + sweep };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg viewBox="0 0 180 180" width={156} height={156} style={{ flexShrink: 0 }}>
        {arcs.map(arc => (
          <path key={arc.status} d={arcPath(CX, CY, OR, IR, arc.start, arc.end)} fill={arc.color} />
        ))}
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize={22} fontWeight={700} fill="#e2e4f0">{total}</text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.4)">campaigns</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 130 }}>
        {segs.map(seg => (
          <div key={seg.status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: seg.color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
              {seg.status.charAt(0) + seg.status.slice(1).toLowerCase()}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{seg.count}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 38, textAlign: 'right' }}>
              {Math.round((seg.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const sel = STATUS_OPTS.find(o => o.value === value) ?? STATUS_OPTS[0];
  return (
    <div className="status-dropdown-wrap" ref={ref}>
      <button className={`status-dropdown-btn${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        {sel.label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', opacity: 0.6 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="status-dropdown-popover">
          {STATUS_OPTS.map(o => (
            <button key={o.value} className={`status-dropdown-opt${o.value === value ? ' active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignBadge({ status }) {
  const cls = {
    ACTIVE:    'campaign-badge campaign-badge-active',
    PAUSED:    'campaign-badge campaign-badge-paused',
    COMPLETED: 'campaign-badge campaign-badge-completed',
    FINISHED:  'campaign-badge campaign-badge-completed',
    DRAFT:     'campaign-badge campaign-badge-draft',
    FAILED:    'campaign-badge campaign-badge-failed',
    ARCHIVED:  'campaign-badge campaign-badge-archived',
  }[status] ?? 'campaign-badge campaign-badge-archived';
  const label = status ? status.charAt(0) + status.slice(1).toLowerCase() : '—';
  return <span className={cls}>{label}</span>;
}

function N({ v, cls }) {
  if (!v) return <span className="num-zero">0</span>;
  return <span className={cls}>{v.toLocaleString()}</span>;
}

function exportCSV(campaigns) {
  const headers = ['Campaign Name','Status','Total Leads','Completed','In Progress','Yet to Start','Blocked','Send Pending','Opens','Replies','Bounces','Clicks','Created'];
  const rows = campaigns.map(c => [
    `"${(c.name || '').replace(/"/g, '""')}"`,
    c.status, c.totalLeads, c.completed, c.inProgress, c.yetToStart,
    c.blocked, c.sendPending, c.opens, c.replies, c.bounces, c.clicks,
    c.created ? new Date(c.created).toLocaleDateString() : '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const [campaigns,   setCampaigns]     = useState([]);
  const [loading,     setLoading]       = useState(false);
  const [error,       setError]         = useState(null);
  const [lastSynced,  setLastSynced]    = useState(null);

  // Charts
  const [showCharts,  setShowCharts]    = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [search,       setSearch]       = useState('');
  const [dSearch,      setDSearch]      = useState('');
  const [calFrom,      setCalFrom]      = useState('');
  const [calTo,        setCalTo]        = useState('');
  const [editField,    setEF]           = useState(null);

  const calRef  = useRef(null);
  const debRef  = useRef(null);

  // ── Fetch all campaigns from SmartLead ────────────────────────────────────
  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/smartlead/campaigns?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCampaigns(data.campaigns ?? []);
      setLastSynced(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh every 2 minutes
  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCampaigns]);

  // ── Close calendar on outside click ───────────────────────────────────────
  useEffect(() => {
    if (!editField) return;
    function h(e) { if (calRef.current && !calRef.current.contains(e.target)) setEF(null); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [editField]);

  function handleSearch(e) {
    const v = e.target.value;
    setSearch(v);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDSearch(v), 300);
  }

  function clearFilters() {
    setStatusFilter('all'); setSearch(''); setDSearch(''); setCalFrom(''); setCalTo(''); setEF(null);
  }

  const hasFilters = statusFilter !== 'all' || dSearch !== '' || calFrom !== '' || calTo !== '';

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = campaigns.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (dSearch && !c.name.toLowerCase().includes(dSearch.toLowerCase())) return false;
    return true;
  });

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const stats = {
    total:        campaigns.length,
    active:       campaigns.filter(c => c.status === 'ACTIVE').length,
    paused:       campaigns.filter(c => c.status === 'PAUSED').length,
    finished:     campaigns.filter(c => c.status === 'FINISHED' || c.status === 'COMPLETED').length,
    totalLeads:   campaigns.reduce((s, c) => s + (c.totalLeads  || 0), 0),
    inProgress:   campaigns.reduce((s, c) => s + (c.inProgress  || 0), 0),
    leadsFinished:campaigns.reduce((s, c) => s + (c.completed   || 0), 0),
    leadsFailed:  campaigns.reduce((s, c) => s + (c.blocked     || 0), 0),
  };

  const pillCounts = {
    all:      campaigns.length,
    ACTIVE:   stats.active,
    PAUSED:   stats.paused,
    FINISHED: stats.finished,
    DRAFT:    campaigns.filter(c => c.status === 'DRAFT').length,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title">Campaigns</h1>
            <span className="campaigns-count-badge">{stats.total}</span>
          </div>
        </div>
        <p className="page-subtitle">SmartLead campaign analytics · live data from your account</p>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Filter bar */}
        <div className="campaigns-filter-bar">
          <div className="campaigns-search-field" style={{ position: 'relative' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input className="form-input" style={{ paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
              placeholder="Search campaigns…" value={search} onChange={handleSearch} />
          </div>

          <StatusDropdown value={statusFilter} onChange={setStatusFilter} />

          <div className="cal-wrap" ref={calRef}>
            <div className="cal-range-trigger">
              <button type="button" className={`cal-field-btn${editField === 'from' ? ' cal-field-active' : ''}`}
                onClick={() => setEF(editField === 'from' ? null : 'from')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {calFrom ? <span className="cal-val">{fmtCalDate(calFrom)}</span> : <span className="cal-placeholder">dd-mm-yyyy</span>}
              </button>
              <span className="cal-sep">—</span>
              <button type="button" className={`cal-field-btn${editField === 'to' ? ' cal-field-active' : ''}`}
                onClick={() => setEF(editField === 'to' ? null : 'to')}>
                {calTo ? <span className="cal-val">{fmtCalDate(calTo)}</span> : <span className="cal-placeholder">dd-mm-yyyy</span>}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>
            </div>
            {editField && (
              <CalendarPicker from={calFrom} to={calTo} editField={editField}
                onSelect={(f, t, next) => { setCalFrom(f); setCalTo(t); setEF(next); }}
                onClear={() => { setCalFrom(''); setCalTo(''); setEF(null); }} />
            )}
          </div>

          {hasFilters && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Clear
            </button>
          )}

          <div className="campaigns-filter-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button className="export-csv-btn" onClick={() => exportCSV(filtered)} disabled={!filtered.length}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
            <button className="btn-primary" onClick={() => fetchCampaigns()} disabled={loading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={loading ? { animation: 'spin 1s linear infinite' } : {}}>
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Sync
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="campaigns-stats-bar">
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Total</span>
            <span className="campaigns-stat-value stat-val-default">{stats.total}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Active</span>
            <span className="campaigns-stat-value stat-val-green">{stats.active}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Paused</span>
            <span className="campaigns-stat-value stat-val-yellow">{stats.paused}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Finished</span>
            <span className="campaigns-stat-value stat-val-blue">{stats.finished}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Total Leads</span>
            <span className="campaigns-stat-value stat-val-default">{stats.totalLeads.toLocaleString()}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">In Progress</span>
            <span className="campaigns-stat-value stat-val-blue">{stats.inProgress.toLocaleString()}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Leads Finished</span>
            <span className="campaigns-stat-value stat-val-green">{stats.leadsFinished.toLocaleString()}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Leads Failed</span>
            <span className="campaigns-stat-value stat-val-red">{stats.leadsFailed.toLocaleString()}</span>
          </div>
          <div className="campaigns-stat-item" style={{ borderRight: 'none' }}>
            <span className="campaigns-stat-label">Last Synced</span>
            <span className="campaigns-stat-value stat-val-muted">
              {lastSynced
                ? lastSynced.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
                : '—'}
            </span>
          </div>
        </div>

        {/* Pills row */}
        <div className="campaigns-pills-row">
          <div className="tabs-pill">
            {STATUS_PILLS.map(p => (
              <button key={p.value} className={`tab-pill-btn${statusFilter === p.value ? ' active' : ''}`}
                onClick={() => setStatusFilter(p.value)}>
                {p.label}
                <span className="tab-pill-count"
                  style={{ color: p.color, background: statusFilter === p.value ? p.bg : undefined }}>
                  {pillCounts[p.value] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Show/Hide Charts */}
        {campaigns.length > 0 && (
          <>
            <div>
              <button className="show-charts-btn" onClick={() => setShowCharts(v => !v)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                {showCharts ? 'Hide Charts' : 'Show Charts'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: 'transform 0.3s ease', transform: showCharts ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
            <div className={`campaigns-charts-area${showCharts ? ' visible' : ''}`}>
              <div className="campaigns-charts-inner">
                <div className="campaigns-charts-grid">
                  <div className="card" style={{ padding: '18px 20px' }}>
                    <p className="card-title" style={{ marginBottom: 16 }}>Top 10 Campaigns by Total Leads</p>
                    <BarChart campaigns={campaigns} />
                  </div>
                  <div className="card" style={{ padding: '18px 20px' }}>
                    <p className="card-title" style={{ marginBottom: 16 }}>Status Breakdown</p>
                    <DonutChart campaigns={campaigns} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'var(--red-400)', fontSize: 13 }}>
            {error.includes('SMARTLEAD_API_KEY')
              ? 'SmartLead API key not configured. Add SMARTLEAD_API_KEY to your environment variables.'
              : `Failed to load campaign data: ${error}`}
          </div>
        )}

        {/* Table or empty */}
        {loading && campaigns.length === 0 ? (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 10 }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <p style={{ margin: 0 }}>Loading campaigns…</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Campaign Name</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Completed</th>
                    <th style={{ textAlign: 'right' }}>In Progress</th>
                    <th style={{ textAlign: 'right' }}>Yet to Start</th>
                    <th style={{ textAlign: 'right' }}>Blocked</th>
                    <th style={{ textAlign: 'right' }}>Send Pending</th>
                    <th style={{ textAlign: 'right' }}>Opens</th>
                    <th style={{ textAlign: 'right' }}>Replies</th>
                    <th style={{ textAlign: 'right' }}>Bounces</th>
                    <th style={{ textAlign: 'right' }}>Clicks</th>
                    <th style={{ minWidth: 100 }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={13} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        No campaigns match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map(c => (
                      <tr key={c.id} className="lead-row campaign-data-row">
                        <td>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</span>
                        </td>
                        <td><CampaignBadge status={c.status} /></td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(c.totalLeads || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}><N v={c.completed}   cls="num-blue"   /></td>
                        <td style={{ textAlign: 'right' }}><N v={c.inProgress}  cls="num-green"  /></td>
                        <td style={{ textAlign: 'right' }}><N v={c.yetToStart}  cls="num-yellow" /></td>
                        <td style={{ textAlign: 'right' }}><N v={c.blocked}     cls="num-red"    /></td>
                        <td style={{ textAlign: 'right' }}><N v={c.sendPending} cls="num-orange" /></td>
                        <td style={{ textAlign: 'right' }}><N v={c.opens}       cls="num-blue"   /></td>
                        <td style={{ textAlign: 'right' }}><N v={c.replies}     cls="num-green"  /></td>
                        <td style={{ textAlign: 'right' }}><N v={c.bounces}     cls="num-red"    /></td>
                        <td style={{ textAlign: 'right' }}><N v={c.clicks}      cls="num-orange" /></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {c.created ? new Date(c.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </>
  );
}

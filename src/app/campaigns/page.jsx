'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import CalendarPicker, { fmtCalDate } from '@/components/CalendarPicker';

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

const COLS = [
  { key: 'name',        label: 'Campaign Name', align: 'left',  w: 220 },
  { key: 'status',      label: 'Status',        align: 'left',  w: 90  },
  { key: 'totalLeads',  label: 'Total',         align: 'right', w: 80  },
  { key: 'completed',   label: 'Completed',     align: 'right', w: 100 },
  { key: 'inProgress',  label: 'In Progress',   align: 'right', w: 100 },
  { key: 'yetToStart',  label: 'Yet to Start',  align: 'right', w: 100 },
  { key: 'blocked',     label: 'Blocked',       align: 'right', w: 90  },
  { key: 'sendPending', label: 'Send Pending',  align: 'right', w: 115 },
  { key: 'opens',       label: 'Opens',         align: 'right', w: 115 },
  { key: 'replies',     label: 'Replies',       align: 'right', w: 115 },
  { key: 'bounces',     label: 'Bounces',       align: 'right', w: 90  },
  { key: 'clicks',      label: 'Clicks',        align: 'right', w: 80  },
  { key: 'created',     label: 'Created',       align: 'left',  w: 110 },
];

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
function BarChart({ campaigns, visible }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!visible) { setAnimate(false); return; }
    const t = setTimeout(() => setAnimate(true), 420);
    return () => clearTimeout(t);
  }, [visible]);

  if (!campaigns.length || !campaigns.some(c => c.emailsSent > 0)) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '20px 0', textAlign: 'center' }}>No email data available yet</p>;
  }
  const top = [...campaigns].sort((a, b) => (b.emailsSent || 0) - (a.emailsSent || 0)).slice(0, 10);
  const maxVal = Math.max(...top.map(c => c.emailsSent || 0), 1);
  const ROW_H = 30, BAR_H = 16, NAME_W = 145, PAD_L = 8, PAD_R = 12, TICK_H = 22;
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
        const barW = Math.max((c.emailsSent / maxVal) * BAR_W, 2);
        const y = i * ROW_H;
        const label = c.name.length > 21 ? c.name.slice(0, 20) + '…' : c.name;
        return (
          <g key={c.id} style={{ opacity: animate ? 1 : 0, transition: `opacity 0.3s ease ${i * 0.06}s` }}>
            <text x={NAME_W - 6} y={y + ROW_H / 2 + 4} textAnchor="end" fontSize={11} fill="rgba(255,255,255,0.65)">
              {label}
            </text>
            <rect
              x={NAME_W + PAD_L} y={y + (ROW_H - BAR_H) / 2} width={barW} height={BAR_H} rx={3}
              fill="#4A7BF7"
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'left center',
                transform: animate ? 'scaleX(1)' : 'scaleX(0)',
                transition: `transform 0.55s cubic-bezier(0.4,0,0.2,1) ${i * 0.06}s`,
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}

const DONUT_SEGS = [
  { label: 'Active',    statuses: ['ACTIVE'],               color: '#4ade80' },
  { label: 'Paused',    statuses: ['PAUSED'],               color: '#facc15' },
  { label: 'Completed', statuses: ['COMPLETED', 'FINISHED'], color: '#60a5fa' },
];

function DonutChart({ campaigns, visible }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!visible) { setAnimate(false); return; }
    const t = setTimeout(() => setAnimate(true), 440);
    return () => clearTimeout(t);
  }, [visible]);

  const total = campaigns.length;
  if (!total) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data</p>;

  const segs = DONUT_SEGS.map(s => ({
    ...s,
    count: campaigns.filter(c => s.statuses.includes(c.status)).length,
  })).filter(s => s.count > 0);

  const CX = 90, CY = 90, OR = 66, IR = 46;
  let angle = -90;
  const arcs = segs.map(seg => {
    const start = angle;
    const sweep = Math.min((seg.count / total) * 360, 359.9);
    angle += sweep;
    return { ...seg, start, end: start + sweep };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'nowrap' }}>
      <svg viewBox="0 0 180 180" width={120} height={120}
        style={{
          flexShrink: 0,
          opacity: animate ? 1 : 0,
          transform: animate ? 'scale(1)' : 'scale(0.8)',
          transition: 'opacity 0.45s ease, transform 0.45s cubic-bezier(0.34,1.56,0.64,1)',
          transformOrigin: 'center',
        }}>
        {arcs.map((arc, i) => (
          <path key={arc.label} d={arcPath(CX, CY, OR, IR, arc.start, arc.end)} fill={arc.color}
            style={{
              opacity: animate ? 1 : 0,
              transform: animate ? 'scale(1)' : 'scale(0.6)',
              transformOrigin: '50% 50%',
              transition: `opacity 0.35s ease ${i * 0.07}s, transform 0.35s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s`,
            }}
          />
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize={24} fontWeight={700} fill="#e2e4f0"
          style={{ opacity: animate ? 1 : 0, transition: 'opacity 0.3s ease 0.3s' }}>{total}</text>
        <text x={CX} y={CY + 15} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.4)"
          style={{ opacity: animate ? 1 : 0, transition: 'opacity 0.3s ease 0.35s' }}>campaigns</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
        {segs.map((seg, i) => (
          <div key={seg.label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateX(0)' : 'translateX(12px)',
            transition: `opacity 0.35s ease ${0.2 + i * 0.06}s, transform 0.35s ease ${0.2 + i * 0.06}s`,
          }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{seg.label}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4, padding: '1px 7px', minWidth: 22, textAlign: 'center',
            }}>{seg.count}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 34, textAlign: 'right' }}>
              {Math.round((seg.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── UI helpers ───────────────────────────────────────────────────────────────
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
  const [campaignIds,  setCampaignIds]  = useState([]);
  const [campaigns,    setCampaigns]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [lastSynced,   setLastSynced]   = useState(null);

  // Add Campaign dialog
  const [showDialog,  setShowDialog]    = useState(false);
  const [dialogInput, setDialogInput]   = useState('');
  const [dialogErr,   setDialogErr]     = useState('');

  // Charts
  const [showCharts,  setShowCharts]    = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [search,       setSearch]       = useState('');
  const [dSearch,      setDSearch]      = useState('');
  const [calFrom,      setCalFrom]      = useState('');
  const [calTo,        setCalTo]        = useState('');
  const [editField,    setEF]           = useState(null);

  // Hover row (for remove button)
  const [hoverRow,    setHoverRow]      = useState(null);

  // Column pin
  const [hoverCol,   setHoverCol]       = useState(null);
  const [pinnedCols, setPinnedCols]     = useState(new Set());

  function togglePin(key) {
    setPinnedCols(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function stickyStyle(key) {
    if (!pinnedCols.has(key)) return {};
    let left = 0;
    for (const col of COLS) {
      if (col.key === key) break;
      if (pinnedCols.has(col.key)) left += col.w;
    }
    return { position: 'sticky', left, zIndex: 2, background: 'var(--bg-card)' };
  }

  const calRef      = useRef(null);
  const debRef      = useRef(null);
  const dialogInRef = useRef(null);

  // ── Load IDs from localStorage on mount ───────────────────────────────────
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sl-campaign-ids') || '[]');
      setCampaignIds(Array.isArray(stored) ? stored : []);
    } catch {}
  }, []);

  // ── Fetch specific campaigns whenever IDs change ───────────────────────────
  const fetchCampaigns = useCallback(async (ids) => {
    if (!ids.length) { setCampaigns([]); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/smartlead/campaigns?ids=${ids.join(',')}&_t=${Date.now()}`, { cache: 'no-store' });
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

  useEffect(() => {
    fetchCampaigns(campaignIds);
    if (!campaignIds.length) return;
    const interval = setInterval(() => fetchCampaigns(campaignIds), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [campaignIds, fetchCampaigns]);

  // ── Close calendar on outside click ───────────────────────────────────────
  useEffect(() => {
    if (!editField) return;
    function h(e) { if (calRef.current && !calRef.current.contains(e.target)) setEF(null); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [editField]);

  // ── Focus dialog input on open ────────────────────────────────────────────
  useEffect(() => {
    if (showDialog) setTimeout(() => dialogInRef.current?.focus(), 50);
  }, [showDialog]);

  // ── Add / remove campaigns ────────────────────────────────────────────────
  function openDialog()  { setDialogInput(''); setDialogErr(''); setShowDialog(true); }
  function closeDialog() { setShowDialog(false); setDialogInput(''); setDialogErr(''); }

  function handleConfirmAdd() {
    const id = dialogInput.trim();
    if (!id)                      { setDialogErr('Please enter a Campaign ID.'); return; }
    if (!/^\d+$/.test(id))        { setDialogErr('Campaign ID must be a number.'); return; }
    if (campaignIds.includes(id)) { setDialogErr('This campaign is already added.'); return; }
    if (campaignIds.length >= 20) { setDialogErr('Maximum 20 campaigns allowed.'); return; }
    const newIds = [...campaignIds, id];
    localStorage.setItem('sl-campaign-ids', JSON.stringify(newIds));
    setCampaignIds(newIds);
    closeDialog();
  }

  function removeCampaign(id) {
    const strId = String(id);
    const newIds = campaignIds.filter(x => x !== strId);
    localStorage.setItem('sl-campaign-ids', JSON.stringify(newIds));
    setCampaignIds(newIds);
    setCampaigns(prev => prev.filter(c => String(c.id) !== strId));
    setHoverRow(null);
  }

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
    if (calFrom && c.created && new Date(c.created) < new Date(calFrom + 'T00:00:00Z')) return false;
    if (calTo   && c.created && new Date(c.created) > new Date(calTo   + 'T23:59:59Z')) return false;
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
          <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={openDialog}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Campaign
          </button>
        </div>
        <p className="page-subtitle">SmartLead campaign analytics · track specific campaigns by ID</p>
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
            <button className="btn-primary" onClick={() => fetchCampaigns(campaignIds)} disabled={loading || !campaignIds.length}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={loading ? { animation: 'spin 1s linear infinite' } : {}}>
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Sync
            </button>
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
            <span className="tab-pill-divider" />
            <span className="tab-pill-stat">
              <span className="tab-pill-stat-label">Total Leads</span>
              <span className="tab-pill-stat-value">{stats.totalLeads.toLocaleString()}</span>
            </span>
            <span className="tab-pill-stat">
              <span className="tab-pill-stat-label">In Progress</span>
              <span className="tab-pill-stat-value stat-val-blue">{stats.inProgress.toLocaleString()}</span>
            </span>
            <span className="tab-pill-stat">
              <span className="tab-pill-stat-label">Leads Finished</span>
              <span className="tab-pill-stat-value stat-val-green">{stats.leadsFinished.toLocaleString()}</span>
            </span>
            <span className="tab-pill-stat">
              <span className="tab-pill-stat-label">Leads Failed</span>
              <span className="tab-pill-stat-value stat-val-red">{stats.leadsFailed.toLocaleString()}</span>
            </span>
            <span className="tab-pill-stat">
              <span className="tab-pill-stat-label">Last Synced</span>
              <span className="tab-pill-stat-value stat-val-muted">
                {lastSynced
                  ? lastSynced.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
                  : '—'}
              </span>
            </span>
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
                    <p className="card-title" style={{ marginBottom: 16 }}>Top 10 Campaigns by Emails Sent</p>
                    <BarChart campaigns={campaigns} visible={showCharts} />
                  </div>
                  <div className="card" style={{ padding: '18px 20px' }}>
                    <p className="card-title" style={{ marginBottom: 16 }}>Status Breakdown</p>
                    <DonutChart campaigns={campaigns} visible={showCharts} />
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
        {campaignIds.length === 0 ? (
          <div className="empty-onboarding">
            <div className="empty-onboarding-hero">
              <div className="empty-onboarding-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h2 className="empty-onboarding-title">No campaigns tracked yet</h2>
              <p className="empty-onboarding-sub">Click <strong>Add Campaign</strong> and enter a SmartLead campaign ID to start tracking its live analytics.</p>
            </div>
          </div>
        ) : loading && campaigns.length === 0 ? (
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
              <table style={{ minWidth: COLS.reduce((s, c) => s + c.w, 0) }}>
                <thead>
                  <tr>
                    {COLS.map(col => {
                      const isP = pinnedCols.has(col.key);
                      const showPin = hoverCol === col.key || isP;
                      return (
                        <th key={col.key}
                          style={{ textAlign: col.align, minWidth: col.w, ...stickyStyle(col.key) }}
                          onMouseEnter={() => setHoverCol(col.key)}
                          onMouseLeave={() => setHoverCol(null)}>
                          <span className="col-header-wrap">
                            <span>{col.label}</span>
                            {showPin && (
                              <button className={`col-pin-btn${isP ? ' col-pin-active' : ''}`}
                                onClick={e => { e.stopPropagation(); togglePin(col.key); }}
                                title={isP ? 'Unpin column' : 'Pin column'}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill={isP ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="17" x2="12" y2="22"/>
                                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                                </svg>
                              </button>
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={COLS.length} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        No campaigns match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map(c => {
                      const pct = v => c.totalLeads > 0 ? Math.round((v || 0) / c.totalLeads * 100) : 0;
                      return (
                        <tr key={c.id} className="lead-row campaign-data-row"
                          onMouseEnter={() => setHoverRow(c.id)}
                          onMouseLeave={() => setHoverRow(null)}>
                          {COLS.map(col => {
                            const ss = stickyStyle(col.key);
                            const ra = { textAlign: 'right' };
                            switch (col.key) {
                              case 'name': return (
                                <td key="name" style={ss}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</span>
                                    {hoverRow === c.id && (
                                      <button className="campaign-remove-btn" onClick={e => { e.stopPropagation(); removeCampaign(c.id); }} title="Remove campaign">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                              case 'status':      return <td key="status"      style={ss}><CampaignBadge status={c.status} /></td>;
                              case 'totalLeads':  return <td key="totalLeads"  style={{ ...ra, fontVariantNumeric: 'tabular-nums', ...ss }}>{(c.totalLeads || 0).toLocaleString()}</td>;
                              case 'completed':   return <td key="completed"   style={{ ...ra, ...ss }}><N v={c.completed}   cls="num-blue"   /></td>;
                              case 'inProgress':  return <td key="inProgress"  style={{ ...ra, ...ss }}><N v={c.inProgress}  cls="num-green"  /></td>;
                              case 'yetToStart':  return <td key="yetToStart"  style={{ ...ra, ...ss }}><N v={c.yetToStart}  cls="num-yellow" /></td>;
                              case 'blocked':     return <td key="blocked"     style={{ ...ra, ...ss }}><N v={c.blocked}     cls="num-red"    /></td>;
                              case 'sendPending': return <td key="sendPending" style={{ ...ra, ...ss }}><N v={c.sendPending} cls="num-orange" /></td>;
                              case 'opens':       return (
                                <td key="opens" style={{ ...ra, ...ss }}>
                                  <span className="num-blue">{(c.opens || 0).toLocaleString()}</span>
                                  <span className="col-pct"> ({pct(c.opens)}%)</span>
                                </td>
                              );
                              case 'replies':     return (
                                <td key="replies" style={{ ...ra, ...ss }}>
                                  <span className="num-green">{(c.replies || 0).toLocaleString()}</span>
                                  <span className="col-pct"> ({pct(c.replies)}%)</span>
                                </td>
                              );
                              case 'bounces':     return <td key="bounces"     style={{ ...ra, ...ss }}><N v={c.bounces}     cls="num-red"    /></td>;
                              case 'clicks':      return <td key="clicks"      style={{ ...ra, ...ss }}><N v={c.clicks}      cls="num-orange" /></td>;
                              case 'created':     return <td key="created"     style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', ...ss }}>{c.created ? new Date(c.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>;
                              default: return <td key={col.key} />;
                            }
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Campaign dialog */}
      {showDialog && (
        <div className="campaign-dialog-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeDialog(); }}>
          <div className="campaign-dialog-card">
            <div className="campaign-dialog-header">
              <h2 className="campaign-dialog-title">Add Campaign</h2>
              <button className="campaign-dialog-close" onClick={closeDialog}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="campaign-dialog-desc">
              Enter your SmartLead campaign ID to track its analytics on this page.
            </p>
            <div className="campaign-dialog-field">
              <label className="campaign-dialog-label">Campaign ID</label>
              <input ref={dialogInRef} className="form-input campaign-dialog-input"
                placeholder="e.g. 12345"
                value={dialogInput}
                onChange={e => { setDialogInput(e.target.value); setDialogErr(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirmAdd(); if (e.key === 'Escape') closeDialog(); }}
                type="text" inputMode="numeric" autoComplete="off" />
              {dialogErr && <p className="campaign-dialog-err">{dialogErr}</p>}
            </div>
            <div className="campaign-dialog-actions">
              <button className="campaign-dialog-cancel" onClick={closeDialog}>Cancel</button>
              <button className="btn-primary campaign-dialog-confirm" onClick={handleConfirmAdd} disabled={!dialogInput.trim()}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

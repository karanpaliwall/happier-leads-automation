'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import CalendarPicker, { fmtCalDate } from '@/components/CalendarPicker';
import { N } from '@/components/NumCell';
import { usePinnedColumns } from '@/hooks/usePinnedColumns';

const STATUS_PILLS = [
  { label: 'All',       value: 'all',       color: 'var(--blue-400)', bg: 'rgba(59,130,246,0.13)'  },
  { label: 'Active',    value: 'ACTIVE',    color: '#4ade80',         bg: 'rgba(74,222,128,0.12)'  },
  { label: 'Paused',    value: 'PAUSED',    color: '#facc15',         bg: 'rgba(234,179,8,0.13)'   },
  { label: 'Completed', value: 'COMPLETED', color: '#60a5fa',         bg: 'rgba(59,130,246,0.12)'  },
  { label: 'Draft',     value: 'DRAFT',     color: '#9ca3af',         bg: 'rgba(107,114,128,0.13)' },
];

const COLS = [
  { key: 'name',       label: 'Campaign Name', align: 'left',  w: 220 },
  { key: 'status',     label: 'Status',        align: 'left',  w: 90  },
  { key: 'list',       label: 'List',          align: 'left',  w: 160 },
  { key: 'total',      label: 'Total',         align: 'right', w: 70  },
  { key: 'inProgress', label: 'In Progress',   align: 'right', w: 105 },
  { key: 'pending',    label: 'Pending',       align: 'right', w: 85  },
  { key: 'finished',   label: 'Finished',      align: 'right', w: 85  },
  { key: 'failed',     label: 'Failed',        align: 'right', w: 70  },
  { key: 'stopped',    label: 'Stopped',       align: 'right', w: 85  },
  { key: 'excluded',   label: 'Excluded',      align: 'right', w: 85  },
  { key: 'created',    label: 'Created',       align: 'left',  w: 110 },
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
const LABEL_W = 140;

function BarChart({ campaigns, visible }) {
  const [animate,  setAnimate]  = useState(false);
  const [tooltip,  setTooltip]  = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!visible) { setAnimate(false); return; }
    const t = setTimeout(() => setAnimate(true), 420);
    return () => clearTimeout(t);
  }, [visible]);

  if (!campaigns.length || !campaigns.some(c => c.total > 0)) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '20px 0', textAlign: 'center' }}>No data available yet</p>;
  }

  const top = [...campaigns].sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 10);
  const maxVal = Math.max(...top.map(c => c.total || 0), 1);
  const tickFractions = [0, 0.25, 0.5, 0.75, 1];
  const TOOLTIP_H = 58;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {tickFractions.map((f, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `calc(${LABEL_W}px + ${f} * (100% - ${LABEL_W}px))`,
          top: 0, height: `${top.length * 36}px`, width: 1,
          background: 'rgba(255,255,255,0.06)', pointerEvents: 'none',
        }} />
      ))}

      {top.map((c, i) => {
        const pct    = Math.max((c.total / maxVal) * 100, 0.3);
        const label  = c.name.length > 21 ? c.name.slice(0, 20) + '…' : c.name;
        const hovered = tooltip?.campaign?.id === c.id;
        return (
          <div key={c.id}
            style={{
              display: 'flex', alignItems: 'center', height: 36,
              opacity: animate ? 1 : 0,
              transition: `opacity 0.28s ease ${i * 0.05}s`,
            }}
            onMouseMove={(e) => {
              const r = containerRef.current?.getBoundingClientRect();
              if (r) setTooltip({ campaign: c, x: e.clientX - r.left, y: e.clientY - r.top });
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            <div style={{
              width: LABEL_W, flexShrink: 0, paddingRight: 8,
              fontSize: 11, color: 'rgba(255,255,255,0.65)',
              textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden',
            }}>
              {label}
            </div>
            <div style={{ flex: 1, height: 18, position: 'relative' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pct}%`,
                background: hovered ? '#6B95FF' : '#4A7BF7',
                borderRadius: 3,
                transformOrigin: 'left center',
                transform: animate ? 'scaleX(1)' : 'scaleX(0)',
                transition: `transform 0.5s cubic-bezier(0.4,0,0.2,1) ${i * 0.05}s, background 0.15s ease`,
              }} />
            </div>
          </div>
        );
      })}

      {tooltip && (() => {
        const tipTop = tooltip.y < TOOLTIP_H + 12 ? tooltip.y + 12 : tooltip.y - TOOLTIP_H - 8;
        return (
          <div style={{
            position: 'absolute', left: tooltip.x, top: tipTop,
            transform: 'translateX(-50%)',
            background: '#1a2035', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6, padding: '5px 10px', pointerEvents: 'none',
            whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', zIndex: 20,
          }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 2 }}>{tooltip.campaign.name}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{(tooltip.campaign.total || 0).toLocaleString()}</div>
          </div>
        );
      })()}

      <div style={{ position: 'relative', marginLeft: LABEL_W, height: 20, marginTop: 5 }}>
        {tickFractions.map((f, i) => {
          const val = Math.round(maxVal * f);
          const disp = val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : String(val);
          return (
            <span key={i} style={{
              position: 'absolute', left: `${f * 100}%`,
              fontSize: 9, color: 'rgba(255,255,255,0.35)', lineHeight: '20px',
              transform: f === 0 ? 'none' : f === 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              whiteSpace: 'nowrap',
            }}>{disp}</span>
          );
        })}
      </div>
    </div>
  );
}

const DONUT_SEGS = [
  { label: 'Active',    statuses: ['ACTIVE'],                color: '#4ade80' },
  { label: 'Paused',    statuses: ['PAUSED'],                color: '#facc15' },
  { label: 'Completed', statuses: ['COMPLETED', 'FINISHED'], color: '#60a5fa' },
  { label: 'Draft',     statuses: ['DRAFT'],                 color: '#6b7280' },
  { label: 'Cancelled', statuses: ['CANCELLED', 'CANCELED'], color: '#f87171' },
];

function DonutChart({ campaigns, visible }) {
  const [animate, setAnimate] = useState(false);
  const [arcTip,  setArcTip]  = useState(null);

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
          transformOrigin: 'center', overflow: 'visible',
        }}>
        {arcs.map((arc, i) => (
          <path key={arc.label} d={arcPath(CX, CY, OR, IR, arc.start, arc.end)} fill={arc.color}
            style={{
              opacity: animate ? (arcTip && arcTip.arc.label !== arc.label ? 0.45 : 1) : 0,
              transform: animate ? 'scale(1)' : 'scale(0.6)',
              transformOrigin: '50% 50%',
              transition: `opacity 0.18s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s`,
              cursor: 'pointer',
            }}
            onMouseMove={(e) => setArcTip({ arc, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setArcTip(null)}
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

      {arcTip && (
        <div style={{
          position: 'fixed', left: arcTip.x + 14, top: arcTip.y - 56,
          background: '#1a2035', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6, padding: '6px 10px', pointerEvents: 'none',
          whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', zIndex: 9999,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: arcTip.arc.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{arcTip.arc.label}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
            {arcTip.arc.count}
            <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginLeft: 5 }}>
              ({Math.round((arcTip.arc.count / total) * 100)}%)
            </span>
          </div>
        </div>
      )}
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
    CANCELLED: 'campaign-badge campaign-badge-failed',
    CANCELED:  'campaign-badge campaign-badge-failed',
    FAILED:    'campaign-badge campaign-badge-failed',
  }[status] ?? 'campaign-badge campaign-badge-archived';
  const label = status ? status.charAt(0) + status.slice(1).toLowerCase() : '—';
  return <span className={cls}>{label}</span>;
}

function exportCSV(campaigns) {
  const headers = ['Campaign Name', 'Status', 'List', 'Total', 'In Progress', 'Pending', 'Finished', 'Failed', 'Stopped', 'Excluded', 'Created'];
  const rows = campaigns.map(c => [
    `"${(c.name || '').replace(/"/g, '""')}"`,
    c.status,
    `"${(c.list || '').replace(/"/g, '""')}"`,
    c.total, c.inProgress, c.pending, c.finished, c.failed, c.stopped, c.excluded,
    c.created ? new Date(c.created).toLocaleDateString() : '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `heyreach-campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function HeyReachCampaignsPage() {
  const [campaignIds,  setCampaignIds]  = useState([]);
  const [campaigns,    setCampaigns]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [lastSynced,   setLastSynced]   = useState(null);

  const [showDialog,    setShowDialog]    = useState(false);
  const [dialogInput,   setDialogInput]   = useState('');
  const [dialogErr,     setDialogErr]     = useState('');
  const [dialogChecking, setDialogChecking] = useState(false);

  const [showCharts,  setShowCharts]    = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [search,       setSearch]       = useState('');
  const [dSearch,      setDSearch]      = useState('');
  const [calFrom,      setCalFrom]      = useState('');
  const [calTo,        setCalTo]        = useState('');
  const [editField,    setEF]           = useState(null);

  const [hoverRow,    setHoverRow]      = useState(null);

  const { hoverCol, setHoverCol, pinnedCols, togglePin, stickyStyle } = usePinnedColumns(COLS);

  const calRef      = useRef(null);
  const debRef      = useRef(null);
  const dialogInRef = useRef(null);

  // ── Load IDs from server; keep localStorage as offline cache ──────────────
  useEffect(() => {
    async function loadIds() {
      let localIds = [];
      try {
        const raw = JSON.parse(localStorage.getItem('hr-campaign-ids') || '[]');
        if (Array.isArray(raw)) localIds = raw;
      } catch {}
      if (localIds.length) setCampaignIds(localIds);

      try {
        const res = await fetch('/api/heyreach/campaign-ids');
        if (!res.ok) return;
        const { ids: serverIds = [] } = await res.json();

        const missing = localIds.filter(id => !serverIds.includes(id));
        await Promise.all(missing.map(id =>
          fetch('/api/heyreach/campaign-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          }).catch(() => {})
        ));
        serverIds.push(...missing);

        setCampaignIds(serverIds);
        localStorage.setItem('hr-campaign-ids', JSON.stringify(serverIds));
      } catch {}
    }
    loadIds();
  }, []);

  // ── Fetch campaigns whenever IDs change ───────────────────────────────────
  const fetchCampaigns = useCallback(async (ids) => {
    if (!ids.length) { setCampaigns([]); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/heyreach/campaigns?ids=${ids.join(',')}&_t=${Date.now()}`, { cache: 'no-store' });
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

  useEffect(() => {
    if (!editField) return;
    function h(e) { if (calRef.current && !calRef.current.contains(e.target)) setEF(null); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [editField]);

  useEffect(() => {
    if (showDialog) setTimeout(() => dialogInRef.current?.focus(), 50);
  }, [showDialog]);

  function openDialog()  { setDialogInput(''); setDialogErr(''); setShowDialog(true); }
  function closeDialog() { setShowDialog(false); setDialogInput(''); setDialogErr(''); setDialogChecking(false); }

  async function handleConfirmAdd() {
    const id = dialogInput.trim();
    if (!id)                      { setDialogErr('Please enter a Campaign ID.'); return; }
    if (!/^\d+$/.test(id))        { setDialogErr('Campaign ID must be a number.'); return; }
    if (campaignIds.includes(id)) { setDialogErr('This campaign is already added.'); return; }
    if (campaignIds.length >= 20) { setDialogErr('Maximum 20 campaigns allowed.'); return; }

    setDialogChecking(true);
    setDialogErr('');
    try {
      // Verify campaign exists before saving
      const verifyRes = await fetch(`/api/heyreach/campaigns?ids=${id}&_t=${Date.now()}`, { cache: 'no-store' });
      const verifyData = await verifyRes.json();
      if (verifyData.error?.includes('HEYREACH_INVALID_KEY')) {
        setDialogErr('API key error — contact admin.');
        return;
      }
      if (!verifyRes.ok || !verifyData.campaigns?.length) {
        setDialogErr(`Campaign ID ${id} not found in HeyReach. Please double-check the ID.`);
        return;
      }

      const res = await fetch('/api/heyreach/campaign-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) { setDialogErr(data.error || 'Failed to add campaign.'); return; }
      const newIds = [...campaignIds, id];
      setCampaignIds(newIds);
      localStorage.setItem('hr-campaign-ids', JSON.stringify(newIds));
      closeDialog();
    } catch {
      setDialogErr('Network error. Please try again.');
    } finally {
      setDialogChecking(false);
    }
  }

  async function removeCampaign(id) {
    const strId = String(id);
    const newIds = campaignIds.filter(x => x !== strId);
    setCampaignIds(newIds);
    setCampaigns(prev => prev.filter(c => String(c.id) !== strId));
    localStorage.setItem('hr-campaign-ids', JSON.stringify(newIds));
    setHoverRow(null);
    try {
      await fetch('/api/heyreach/campaign-ids', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: strId }),
      });
    } catch {}
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

  const filtered = campaigns.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (dSearch && !c.name.toLowerCase().includes(dSearch.toLowerCase())) return false;
    if (calFrom && c.created && new Date(c.created) < new Date(calFrom + 'T00:00:00Z')) return false;
    if (calTo   && c.created && new Date(c.created) > new Date(calTo   + 'T23:59:59Z')) return false;
    return true;
  });

  const stats = {
    total:      campaigns.length,
    active:     campaigns.filter(c => c.status === 'ACTIVE').length,
    paused:     campaigns.filter(c => c.status === 'PAUSED').length,
    completed:  campaigns.filter(c => c.status === 'COMPLETED' || c.status === 'FINISHED').length,
    totalLeads: campaigns.reduce((s, c) => s + (c.total      || 0), 0),
    inProgress: campaigns.reduce((s, c) => s + (c.inProgress || 0), 0),
    finished:   campaigns.reduce((s, c) => s + (c.finished   || 0), 0),
    failed:     campaigns.reduce((s, c) => s + (c.failed     || 0), 0),
  };

  const pillCounts = {
    all:       campaigns.length,
    ACTIVE:    stats.active,
    PAUSED:    stats.paused,
    COMPLETED: stats.completed,
    DRAFT:     campaigns.filter(c => c.status === 'DRAFT').length,
  };

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
        <p className="page-subtitle">HeyReach campaign analytics · track specific campaigns by ID</p>
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
              <span className="tab-pill-stat-label">Finished</span>
              <span className="tab-pill-stat-value stat-val-green">{stats.finished.toLocaleString()}</span>
            </span>
            <span className="tab-pill-stat">
              <span className="tab-pill-stat-label">Failed</span>
              <span className="tab-pill-stat-value stat-val-red">{stats.failed.toLocaleString()}</span>
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
                    <p className="card-title" style={{ marginBottom: 14 }}>Top 10 Campaigns by Total Leads</p>
                    <BarChart campaigns={campaigns} visible={showCharts} />
                  </div>
                  <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
                    <p className="card-title" style={{ marginBottom: 14 }}>Status Breakdown</p>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                      <DonutChart campaigns={campaigns} visible={showCharts} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'var(--red-400)', fontSize: 13 }}>
            {error.includes('HEYREACH_INVALID_KEY')
              ? 'HeyReach API key is invalid. Please update HEYREACH_API_KEY in Vercel environment settings.'
              : error.includes('HEYREACH_API_KEY')
              ? 'HeyReach API key not configured. Add HEYREACH_API_KEY to your environment variables.'
              : `Failed to load campaign data: ${error}`}
          </div>
        )}

        {/* Table or empty */}
        {campaignIds.length === 0 ? (
          <div className="empty-onboarding">
            <div className="empty-onboarding-hero">
              <div className="empty-onboarding-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h2 className="empty-onboarding-title">No campaigns tracked yet</h2>
              <p className="empty-onboarding-sub">Click <strong>Add Campaign</strong> and enter a HeyReach campaign ID to start tracking its LinkedIn analytics.</p>
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
                              case 'status': return <td key="status" style={ss}><CampaignBadge status={c.status} /></td>;
                              case 'list': return (
                                <td key="list" style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...ss }}>
                                  {c.list || '—'}
                                </td>
                              );
                              case 'total':      return <td key="total"      style={{ ...ra, fontVariantNumeric: 'tabular-nums', ...ss }}>{(c.total || 0).toLocaleString()}</td>;
                              case 'inProgress': return <td key="inProgress" style={{ ...ra, ...ss }}><N v={c.inProgress} cls="num-blue"   /></td>;
                              case 'pending':    return <td key="pending"    style={{ ...ra, ...ss }}><N v={c.pending}    cls="num-yellow" /></td>;
                              case 'finished':   return <td key="finished"   style={{ ...ra, ...ss }}><N v={c.finished}   cls="num-green"  /></td>;
                              case 'failed':     return <td key="failed"     style={{ ...ra, ...ss }}><N v={c.failed}     cls="num-red"    /></td>;
                              case 'stopped':    return <td key="stopped"    style={{ ...ra, ...ss }}><N v={c.stopped}    cls="num-orange" /></td>;
                              case 'excluded':   return <td key="excluded"   style={{ ...ra, ...ss }}><N v={c.excluded}   cls="num-yellow" /></td>;
                              case 'created': return (
                                <td key="created" style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', ...ss }}>
                                  {c.created ? new Date(c.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                </td>
                              );
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
              Enter your HeyReach campaign ID to track its LinkedIn analytics on this page.
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
              <button className="campaign-dialog-cancel" onClick={closeDialog} disabled={dialogChecking}>Cancel</button>
              <button className="btn-primary campaign-dialog-confirm" onClick={handleConfirmAdd} disabled={!dialogInput.trim() || dialogChecking}>
                {dialogChecking
                  ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> Checking…</>
                  : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

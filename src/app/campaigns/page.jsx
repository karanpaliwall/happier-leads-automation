'use client';
import { useState, useEffect, useRef } from 'react';
import CalendarPicker, { fmtCalDate } from '@/components/CalendarPicker';

const CAMPAIGNS = [];

const STATUS_PILLS = [
  { label: 'All',       value: 'all',       color: 'var(--blue-400)',  bg: 'rgba(59,130,246,0.13)'  },
  { label: 'Active',    value: 'active',    color: '#4ade80',          bg: 'rgba(74,222,128,0.12)'  },
  { label: 'Paused',    value: 'paused',    color: '#facc15',          bg: 'rgba(234,179,8,0.13)'   },
  { label: 'Completed', value: 'completed', color: '#9ca3af',          bg: 'rgba(107,114,128,0.13)' },
  { label: 'Draft',     value: 'draft',     color: '#9ca3af',          bg: 'rgba(107,114,128,0.13)' },
];

const STATUS_OPTS = [
  { label: 'All Status', value: 'all'       },
  { label: 'Active',     value: 'active'    },
  { label: 'Paused',     value: 'paused'    },
  { label: 'Completed',  value: 'completed' },
  { label: 'Draft',      value: 'draft'     },
  { label: 'Archived',   value: 'archived'  },
];

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const selected = STATUS_OPTS.find(o => o.value === value) ?? STATUS_OPTS[0];
  return (
    <div className="status-dropdown-wrap" ref={ref}>
      <button className={`status-dropdown-btn${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        {selected.label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft:'auto', opacity:0.6 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="status-dropdown-popover">
          {STATUS_OPTS.map(o => (
            <button key={o.value} className={`status-dropdown-opt${o.value === value ? ' active' : ''}`} onClick={() => { onChange(o.value); setOpen(false); }}>
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
    ARCHIVED:  'campaign-badge campaign-badge-archived',
    COMPLETED: 'campaign-badge campaign-badge-completed',
    DRAFT:     'campaign-badge campaign-badge-draft',
  }[status] ?? 'campaign-badge campaign-badge-archived';
  return <span className={cls}>{status}</span>;
}

function Num({ value, cls }) {
  if (value === 0) return <span className="num-zero">0</span>;
  return <span className={cls}>{value.toLocaleString()}</span>;
}

function exportCSV(campaigns) {
  const headers = ['Campaign Name','Status','Total Leads','Completed','In Progress','Yet to Start','Blocked','Sent','Pending'];
  const rows = campaigns.map(c => [
    `"${c.name}"`, c.status, c.totalLeads, c.completed, c.inProgress, c.yetToStart, c.blocked, c.sent, c.pending,
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `campaigns-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]     = useState('');
  const [calFrom, setCalFrom]   = useState('');
  const [calTo, setCalTo]       = useState('');
  const [editField, setEF]      = useState(null);
  const [lastSynced] = useState(null);
  const calRef = useRef(null);
  const debounceRef = useRef(null);
  const [dSearch, setDSearch]   = useState('');

  useEffect(() => {
    if (!editField) return;
    function h(e) { if (calRef.current && !calRef.current.contains(e.target)) setEF(null); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [editField]);

  function handleSearch(e) {
    const v = e.target.value;
    setSearch(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDSearch(v), 300);
  }

  function clearFilters() {
    setStatusFilter('all'); setSearch(''); setDSearch(''); setCalFrom(''); setCalTo(''); setEF(null);
  }

  const hasFilters = statusFilter !== 'all' || dSearch !== '' || calFrom !== '' || calTo !== '';

  const filtered = CAMPAIGNS.filter(c => {
    if (statusFilter !== 'all' && c.status.toLowerCase() !== statusFilter) return false;
    if (dSearch && !c.name.toLowerCase().includes(dSearch.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all:       CAMPAIGNS.length,
    active:    CAMPAIGNS.filter(c => c.status === 'ACTIVE').length,
    paused:    CAMPAIGNS.filter(c => c.status === 'PAUSED').length,
    completed: CAMPAIGNS.filter(c => c.status === 'COMPLETED').length,
    draft:     CAMPAIGNS.filter(c => c.status === 'DRAFT').length,
  };

  const metrics = {
    leadsCompleted: CAMPAIGNS.reduce((s,c) => s + (c.completed  || 0), 0),
    inProgress:     CAMPAIGNS.reduce((s,c) => s + (c.inProgress || 0), 0),
    yetToStart:     CAMPAIGNS.reduce((s,c) => s + (c.yetToStart || 0), 0),
    blocked:        CAMPAIGNS.reduce((s,c) => s + (c.blocked    || 0), 0),
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <h1 className="page-title">Campaigns</h1>
        </div>
        <p className="page-subtitle">SmartLead campaign pipeline · sync status, lead progress &amp; outreach metrics</p>
      </div>

      <div className="page-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Top filter bar: search + status dropdown + date range + actions */}
        <div className="campaigns-filter-bar">
          <div style={{ position:'relative', flex:'0 1 240px', minWidth:130 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="form-input"
              style={{ paddingLeft:32, width:'100%', boxSizing:'border-box' }}
              placeholder="Search campaigns…"
              value={search}
              onChange={handleSearch}
            />
          </div>

          <StatusDropdown value={statusFilter} onChange={setStatusFilter} />

          <div className="cal-wrap" ref={calRef}>
            <div className="cal-range-trigger">
              <button
                type="button"
                className={`cal-field-btn${editField === 'from' ? ' cal-field-active' : ''}`}
                onClick={() => setEF(editField === 'from' ? null : 'from')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {calFrom ? <span className="cal-val">{fmtCalDate(calFrom)}</span> : <span className="cal-placeholder">dd-mm-yyyy</span>}
              </button>
              <span className="cal-sep">—</span>
              <button
                type="button"
                className={`cal-field-btn${editField === 'to' ? ' cal-field-active' : ''}`}
                onClick={() => setEF(editField === 'to' ? null : 'to')}
              >
                {calTo ? <span className="cal-val">{fmtCalDate(calTo)}</span> : <span className="cal-placeholder">dd-mm-yyyy</span>}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </button>
            </div>
            {editField && (
              <CalendarPicker
                from={calFrom} to={calTo} editField={editField}
                onSelect={(f,t,next) => { setCalFrom(f); setCalTo(t); setEF(next); }}
                onClear={() => { setCalFrom(''); setCalTo(''); setEF(null); }}
              />
            )}
          </div>

          {hasFilters && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear
            </button>
          )}

          <div className="campaigns-filter-actions" style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <button className="export-csv-btn" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
            <button className="btn-primary" disabled title="SmartLead sync — Phase 2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6"/>
                <path d="M2.5 12a10 10 0 0 1 10-10 10 10 0 0 1 7.07 2.93L21.5 8"/>
                <path d="M2.5 22v-6h6"/>
                <path d="M21.5 12a10 10 0 0 1-10 10 10 10 0 0 1-7.07-2.93L2.5 16"/>
              </svg>
              Sync Live
            </button>
          </div>
        </div>

        {/* Pills row: clickable status filters + display-only metrics */}
        <div className="campaigns-pills-row">
          <div className="tabs-pill">
            {STATUS_PILLS.map(p => (
              <button
                key={p.value}
                className={`tab-pill-btn${statusFilter === p.value ? ' active' : ''}`}
                onClick={() => setStatusFilter(p.value)}
              >
                {p.label}
                <span
                  className="tab-pill-count"
                  style={{ color: p.color, background: statusFilter === p.value ? p.bg : undefined }}
                >
                  {counts[p.value] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="tabs-pill">
            {[
              { label:'Leads Completed', val: metrics.leadsCompleted, color:'#60a5fa', bg:'rgba(59,130,246,0.13)'  },
              { label:'In Progress',     val: metrics.inProgress,     color:'#4ade80', bg:'rgba(74,222,128,0.12)'  },
              { label:'Yet to Start',    val: metrics.yetToStart,     color:'#facc15', bg:'rgba(234,179,8,0.13)'   },
              { label:'Blocked',         val: metrics.blocked,        color:'#f87171', bg:'rgba(248,113,113,0.13)' },
            ].map(m => (
              <div key={m.label} className="metric-pill">
                {m.label}
                <span className="tab-pill-count" style={{ color: m.color, background: m.bg, opacity:1 }}>
                  {m.val}
                </span>
              </div>
            ))}
            <div className="metric-pill">
              Last Synced
              <span className="tab-pill-count" style={{ opacity:1, color:'var(--text-muted)' }}>
                {lastSynced
                  ? lastSynced.toLocaleString('en-US',{ month:'numeric', day:'numeric', hour:'numeric', minute:'2-digit' })
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Table / empty state */}
        {CAMPAIGNS.length === 0 ? (
          <div className="empty-onboarding">
            <div className="empty-onboarding-hero">
              <div className="empty-onboarding-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <h2 className="empty-onboarding-title">No campaigns yet</h2>
              <p className="empty-onboarding-sub">Click <strong>Sync Live</strong> to pull your SmartLead campaigns, or wait for the first sync to complete.</p>
            </div>
            <div className="empty-steps">
              <div className="empty-step">
                <div className="empty-step-num">1</div>
                <div className="empty-step-body">
                  <div className="empty-step-title">Connect SmartLead</div>
                  <div className="empty-step-desc">Add your SmartLead API key in settings so this dashboard can read your campaign data.</div>
                </div>
              </div>
              <div className="empty-step">
                <div className="empty-step-num">2</div>
                <div className="empty-step-body">
                  <div className="empty-step-title">Sync campaigns</div>
                  <div className="empty-step-desc">Hit <strong>Sync Live</strong> in the top-right to pull the latest campaign list and stats from SmartLead.</div>
                </div>
              </div>
              <div className="empty-step">
                <div className="empty-step-num">3</div>
                <div className="empty-step-body">
                  <div className="empty-step-title">Push leads to campaigns</div>
                  <div className="empty-step-desc">Use the <strong>Push to Smart Lead</strong> action on any lead to add them to an active campaign.</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding:0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth:240 }}>Campaign Name</th>
                    <th>Status</th>
                    <th style={{ textAlign:'right' }}>Total Leads</th>
                    <th style={{ textAlign:'right' }}>Completed</th>
                    <th style={{ textAlign:'right' }}>In Progress</th>
                    <th style={{ textAlign:'right' }}>Yet to Start</th>
                    <th style={{ textAlign:'right' }}>Blocked</th>
                    <th style={{ textAlign:'right' }}>Sent</th>
                    <th style={{ textAlign:'right' }}>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)' }}>
                        No campaigns match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map(c => (
                      <tr key={c.id} className="lead-row">
                        <td style={{ fontWeight:500, color:'var(--text-primary)' }}>{c.name}</td>
                        <td><CampaignBadge status={c.status} /></td>
                        <td style={{ textAlign:'right' }}>{c.totalLeads.toLocaleString()}</td>
                        <td style={{ textAlign:'right' }}><Num value={c.completed}  cls="num-blue"   /></td>
                        <td style={{ textAlign:'right' }}><Num value={c.inProgress} cls="num-green"  /></td>
                        <td style={{ textAlign:'right' }}><Num value={c.yetToStart} cls="num-yellow" /></td>
                        <td style={{ textAlign:'right' }}><Num value={c.blocked}    cls="num-red"    /></td>
                        <td style={{ textAlign:'right' }}>{c.sent.toLocaleString()}</td>
                        <td style={{ textAlign:'right' }}><Num value={c.pending}    cls="num-orange" /></td>
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

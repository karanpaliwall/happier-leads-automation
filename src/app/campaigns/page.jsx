'use client';
import { useState, useEffect, useRef } from 'react';

const CAMPAIGNS = [];

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function fmtCalDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function CalendarPicker({ from, to, editField, onSelect, onClear }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const seed = (editField === 'to' && to)   ? new Date(to   + 'T00:00:00')
             : (editField === 'from' && from) ? new Date(from + 'T00:00:00')
             : new Date();
  const [vy, setVy] = useState(seed.getFullYear());
  const [vm, setVm] = useState(seed.getMonth());

  const firstDow = new Date(vy, vm, 1).getDay();
  const dim      = new Date(vy, vm + 1, 0).getDate();

  function iso(d) {
    return `${vy}-${String(vm + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  function clickDay(d) {
    const s = iso(d);
    if (editField === 'from') {
      const keepTo = to && s <= to ? to : '';
      onSelect(s, keepTo, 'to');
    } else {
      if (!from || s >= from) onSelect(from || s, s, null);
      else onSelect(s, '', 'to');
    }
  }

  function prev() { if (vm === 0) { setVy(y => y-1); setVm(11); } else setVm(m => m-1); }
  function next() { if (vm === 11) { setVy(y => y+1); setVm(0);  } else setVm(m => m+1); }

  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: dim }, (_,i) => i+1)];

  return (
    <div className="cal-popover">
      <div className="cal-editing-hint">
        {editField === 'from' ? 'Select start date' : 'Select end date'}
      </div>
      <div className="cal-nav-row">
        <span className="cal-month-title">{CAL_MONTHS[vm]}, {vy}</span>
        <div style={{ display:'flex', gap:2 }}>
          <button className="cal-nav-btn" type="button" onClick={prev}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button className="cal-nav-btn" type="button" onClick={next}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>
      <div className="cal-grid">
        {CAL_DAYS.map(dl => <div key={dl} className="cal-dow">{dl}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const s   = iso(d);
          const sel = s === from || s === to;
          const inR = from && to && s > from && s < to;
          return (
            <button
              key={d}
              type="button"
              className={`cal-day${sel ? ' cal-sel' : s === todayIso ? ' cal-today' : ''}${inR ? ' cal-range' : ''}`}
              onClick={() => clickDay(d)}
            >{d}</button>
          );
        })}
      </div>
      <div className="cal-footer-row">
        <button className="cal-foot-btn" type="button" onClick={onClear}>Clear</button>
        <button className="cal-foot-btn cal-foot-today" type="button" onClick={() => {
          const t = new Date().toISOString().slice(0,10);
          if (editField === 'from') onSelect(t, to && to >= t ? to : '', 'to');
          else onSelect(from || t, t, null);
        }}>Today</button>
      </div>
    </div>
  );
}

const TABS = [
  { label: 'All',       value: 'all',       color: 'var(--blue-400)',  bg: 'rgba(59,130,246,0.13)'  },
  { label: 'Active',    value: 'active',    color: '#4ade80',          bg: 'rgba(74,222,128,0.12)'  },
  { label: 'Paused',    value: 'paused',    color: '#facc15',          bg: 'rgba(234,179,8,0.13)'   },
  { label: 'Archived',  value: 'archived',  color: '#9ca3af',          bg: 'rgba(107,114,128,0.13)' },
];

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
  const [tab, setTab]           = useState('all');
  const [search, setSearch]     = useState('');
  const [timeFilter, setTime]   = useState('');
  const [calFrom, setCalFrom]   = useState('');
  const [calTo, setCalTo]       = useState('');
  const [editField, setEF]      = useState(null);
  const [syncing, setSyncing]   = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
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
    setTab('all'); setSearch(''); setDSearch(''); setTime(''); setCalFrom(''); setCalTo(''); setEF(null);
  }

  const hasFilters = tab !== 'all' || dSearch !== '' || timeFilter !== '' || calFrom !== '' || calTo !== '';

  const filtered = CAMPAIGNS.filter(c => {
    if (tab !== 'all' && c.status.toLowerCase() !== tab) return false;
    if (dSearch && !c.name.toLowerCase().includes(dSearch.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all:      CAMPAIGNS.length,
    active:   CAMPAIGNS.filter(c => c.status === 'ACTIVE').length,
    paused:   CAMPAIGNS.filter(c => c.status === 'PAUSED').length,
    archived: CAMPAIGNS.filter(c => c.status === 'ARCHIVED').length,
  };

  const stats = {
    total:          CAMPAIGNS.length,
    active:         counts.active,
    paused:         counts.paused,
    completed:      CAMPAIGNS.filter(c => c.status === 'COMPLETED').length,
    draft:          CAMPAIGNS.filter(c => c.status === 'DRAFT').length,
    leadsCompleted: CAMPAIGNS.reduce((s,c) => s + (c.completed  || 0), 0),
    inProgress:     CAMPAIGNS.reduce((s,c) => s + (c.inProgress || 0), 0),
    yetToStart:     CAMPAIGNS.reduce((s,c) => s + (c.yetToStart || 0), 0),
    blocked:        CAMPAIGNS.reduce((s,c) => s + (c.blocked    || 0), 0),
  };

  function handleSyncLive() {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setLastSynced(new Date()); }, 1500);
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <h1 className="page-title">Campaigns</h1>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto' }}>
            <button className="export-csv-btn" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
            <button className="btn-primary" onClick={handleSyncLive} disabled={syncing}>
              {syncing ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation:'spin 0.7s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Syncing…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6"/>
                    <path d="M2.5 12a10 10 0 0 1 10-10 10 10 0 0 1 7.07 2.93L21.5 8"/>
                    <path d="M2.5 22v-6h6"/>
                    <path d="M21.5 12a10 10 0 0 1-10 10 10 10 0 0 1-7.07-2.93L2.5 16"/>
                  </svg>
                  Sync Live
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="page-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Filter bar — same structure as Leads page */}
        <div className="filter-bar">
          <div className="tabs-pill">
            {TABS.map(t => (
              <button
                key={t.value}
                className={`tab-pill-btn${tab === t.value ? ' active' : ''}`}
                onClick={() => setTab(t.value)}
              >
                {t.label}
                <span
                  className="tab-pill-count"
                  style={{ color: t.color, background: tab === t.value ? t.bg : undefined }}
                >
                  {counts[t.value] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="time-filter-group">
            {['24h','7d'].map(tf => (
              <button
                key={tf}
                className={`time-filter-btn${timeFilter === tf ? ' active' : ''}`}
                onClick={() => { setTime(timeFilter === tf ? '' : tf); setCalFrom(''); setCalTo(''); setEF(null); }}
              >{tf}</button>
            ))}
            <div className="cal-wrap" ref={calRef}>
              <div className="cal-range-trigger">
                <button
                  type="button"
                  className={`cal-field-btn${editField === 'from' ? ' cal-field-active' : ''}`}
                  onClick={() => { setTime(''); setEF(editField === 'from' ? null : 'from'); }}
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
                  onClick={() => { setTime(''); setEF(editField === 'to' ? null : 'to'); }}
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
          </div>

          <div style={{ position:'relative', flex:'1 1 180px', maxWidth:320 }}>
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

          {hasFilters && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div className="campaigns-stats-bar">
          {[
            { label:'Total',           val: stats.total,          cls:'stat-val-default' },
            { label:'Active',          val: stats.active,         cls:'stat-val-green'   },
            { label:'Paused',          val: stats.paused,         cls:'stat-val-yellow'  },
            { label:'Completed',       val: stats.completed,      cls:'stat-val-default' },
            { label:'Draft',           val: stats.draft,          cls:'stat-val-default' },
            { label:'Leads Completed', val: stats.leadsCompleted, cls:'stat-val-blue'    },
            { label:'In Progress',     val: stats.inProgress,     cls:'stat-val-green'   },
            { label:'Yet to Start',    val: stats.yetToStart,     cls:'stat-val-yellow'  },
            { label:'Blocked',         val: stats.blocked,        cls:'stat-val-red'     },
            { label:'Last Synced',     val: null,                 cls:'stat-val-muted'   },
          ].map(({ label, val, cls }) => (
            <div key={label} className="campaigns-stat-item">
              <span className="campaigns-stat-label">{label}</span>
              {label === 'Last Synced' ? (
                <span className="campaigns-stat-value stat-val-muted">
                  {lastSynced
                    ? lastSynced.toLocaleString('en-US',{ month:'numeric', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', second:'2-digit' })
                    : '—'}
                </span>
              ) : (
                <span className={`campaigns-stat-value ${cls}`}>{(val ?? 0).toLocaleString()}</span>
              )}
            </div>
          ))}
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

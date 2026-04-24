'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const MOCK_CAMPAIGNS = [
  { id: 'c1',  name: 'ImpactCraftAI_April_US_Campaign',               status: 'ACTIVE',   totalLeads: 502,  completed: 2,  inProgress: 98,  yetToStart: 27, blocked: 0, sent: 150, pending: 352 },
  { id: 'c2',  name: 'ImpactCraftAI_April_India_Campaign',            status: 'ACTIVE',   totalLeads: 622,  completed: 1,  inProgress: 95,  yetToStart: 60, blocked: 0, sent: 150, pending: 472 },
  { id: 'c3',  name: 'impact testing 16 april',                       status: 'ARCHIVED', totalLeads: 3,    completed: 3,  inProgress: 0,   yetToStart: 0,  blocked: 0, sent: 3,   pending: 0   },
  { id: 'c4',  name: 'impactcraft testing april - company emails - copy', status: 'ARCHIVED', totalLeads: 4, completed: 4, inProgress: 0,   yetToStart: 0,  blocked: 0, sent: 4,   pending: 0   },
  { id: 'c5',  name: 'impactcraft testing april - company emails',    status: 'ARCHIVED', totalLeads: 12,   completed: 11, inProgress: 0,  yetToStart: 0,  blocked: 1, sent: 12,  pending: 0   },
  { id: 'c6',  name: 'impactcraft testing april',                     status: 'ARCHIVED', totalLeads: 6,    completed: 6,  inProgress: 0,   yetToStart: 0,  blocked: 0, sent: 6,   pending: 0   },
  { id: 'c7',  name: 'Moora_Faire_April_2026',                        status: 'ACTIVE',   totalLeads: 374,  completed: 68, inProgress: 33,  yetToStart: 0,  blocked: 2, sent: 341, pending: 33  },
  { id: 'c8',  name: 'Growleads_April_Happier_Leads_Europe',          status: 'ACTIVE',   totalLeads: 634,  completed: 2,  inProgress: 158, yetToStart: 0,  blocked: 0, sent: 210, pending: 424 },
  { id: 'c9',  name: 'Growleads_April_Happier_Leads_India',           status: 'ACTIVE',   totalLeads: 737,  completed: 2,  inProgress: 165, yetToStart: 18, blocked: 3, sent: 170, pending: 567 },
  { id: 'c10', name: 'Growleads_April_Cal_Campaign',                  status: 'PAUSED',   totalLeads: 329,  completed: 2,  inProgress: 64,  yetToStart: 0,  blocked: 6, sent: 174, pending: 155 },
  { id: 'c11', name: 'Growleads_April_Happier_Leads_Suggested',       status: 'ACTIVE',   totalLeads: 1005, completed: 10, inProgress: 219, yetToStart: 29, blocked: 2, sent: 358, pending: 647 },
  { id: 'c12', name: 'ImpactCraftAI_April_Testing_B',                 status: 'PAUSED',   totalLeads: 343,  completed: 19, inProgress: 96,  yetToStart: 0,  blocked: 0, sent: 214, pending: 129 },
];

const STATUS_OPTIONS = ['All Status', 'Active', 'Started', 'Paused', 'Completed', 'Draft'];

function statusToFilter(status) {
  return {
    ACTIVE:    'Active',
    PAUSED:    'Paused',
    COMPLETED: 'Completed',
    DRAFT:     'Draft',
    ARCHIVED:  null,
  }[status] ?? null;
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

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="status-dropdown-wrap" ref={ref}>
      <button
        className={`status-dropdown-btn${open ? ' open' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="status-dropdown-popover">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt}
              className={`status-dropdown-opt${value === opt ? ' active' : ''}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function exportCSV(campaigns) {
  const headers = ['Campaign Name', 'Status', 'Total Leads', 'Completed', 'In Progress', 'Yet to Start', 'Blocked', 'Sent', 'Pending'];
  const rows = campaigns.map(c => [
    `"${c.name}"`, c.status, c.totalLeads, c.completed, c.inProgress, c.yetToStart, c.blocked, c.sent, c.pending,
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

export default function CampaignsPage() {
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('All Status');
  const [syncing, setSyncing]       = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  const filtered = MOCK_CAMPAIGNS.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All Status' || statusToFilter(c.status) === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total:          MOCK_CAMPAIGNS.length,
    active:         MOCK_CAMPAIGNS.filter(c => c.status === 'ACTIVE').length,
    paused:         MOCK_CAMPAIGNS.filter(c => c.status === 'PAUSED').length,
    completed:      MOCK_CAMPAIGNS.filter(c => c.status === 'COMPLETED').length,
    draft:          MOCK_CAMPAIGNS.filter(c => c.status === 'DRAFT').length,
    leadsCompleted: MOCK_CAMPAIGNS.reduce((s, c) => s + c.completed, 0),
    inProgress:     MOCK_CAMPAIGNS.reduce((s, c) => s + c.inProgress, 0),
    yetToStart:     MOCK_CAMPAIGNS.reduce((s, c) => s + c.yetToStart, 0),
    blocked:        MOCK_CAMPAIGNS.reduce((s, c) => s + c.blocked, 0),
  };

  function handleSyncLive() {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSynced(new Date());
    }, 1500);
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title">Campaigns</h1>
            <span className="campaigns-count-badge">{stats.total} campaigns</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <button className="export-csv-btn" onClick={() => exportCSV(filtered)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
            <button
              className="btn-primary"
              onClick={handleSyncLive}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.7s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Syncing…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6" />
                    <path d="M2.5 12a10 10 0 0 1 10-10 10 10 0 0 1 7.07 2.93L21.5 8" />
                    <path d="M2.5 22v-6h6" />
                    <path d="M21.5 12a10 10 0 0 1-10 10 10 10 0 0 1-7.07-2.93L2.5 16" />
                  </svg>
                  Sync Live
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Filter bar */}
        <div className="campaigns-filter-bar">
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="form-input"
              style={{ paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
              placeholder="Search campaigns…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <StatusDropdown value={statusFilter} onChange={setStatus} />
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
            <span className="campaigns-stat-label">Completed</span>
            <span className="campaigns-stat-value stat-val-default">{stats.completed}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Draft</span>
            <span className="campaigns-stat-value stat-val-default">{stats.draft}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Leads Completed</span>
            <span className="campaigns-stat-value stat-val-blue">{stats.leadsCompleted.toLocaleString()}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">In Progress</span>
            <span className="campaigns-stat-value stat-val-green">{stats.inProgress.toLocaleString()}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Yet to Start</span>
            <span className="campaigns-stat-value stat-val-yellow">{stats.yetToStart.toLocaleString()}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Blocked</span>
            <span className="campaigns-stat-value stat-val-red">{stats.blocked.toLocaleString()}</span>
          </div>
          <div className="campaigns-stat-item">
            <span className="campaigns-stat-label">Last Synced</span>
            <span className="campaigns-stat-value stat-val-muted">
              {lastSynced
                ? lastSynced.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
                : '—'}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 240 }}>Campaign Name</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total Leads</th>
                  <th style={{ textAlign: 'right' }}>Completed</th>
                  <th style={{ textAlign: 'right' }}>In Progress</th>
                  <th style={{ textAlign: 'right' }}>Yet to Start</th>
                  <th style={{ textAlign: 'right' }}>Blocked</th>
                  <th style={{ textAlign: 'right' }}>Sent</th>
                  <th style={{ textAlign: 'right' }}>Pending</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      No campaigns match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => (
                    <tr key={c.id} className="lead-row">
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</td>
                      <td><CampaignBadge status={c.status} /></td>
                      <td style={{ textAlign: 'right' }}>{c.totalLeads.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}><Num value={c.completed}   cls="num-blue"   /></td>
                      <td style={{ textAlign: 'right' }}><Num value={c.inProgress}  cls="num-green"  /></td>
                      <td style={{ textAlign: 'right' }}><Num value={c.yetToStart}  cls="num-yellow" /></td>
                      <td style={{ textAlign: 'right' }}><Num value={c.blocked}     cls="num-red"    /></td>
                      <td style={{ textAlign: 'right' }}>{c.sent.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}><Num value={c.pending}     cls="num-orange" /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

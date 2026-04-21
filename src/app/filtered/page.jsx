'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function ScoreBar({ value, max, color }) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="score-cell">
      <div className="score-bar">
        <div className="score-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        {value != null ? `${value}/${max}` : '—'}
      </span>
    </div>
  );
}

const TABS = [
  { label: 'All Leads', value: '' },
  { label: 'Exact', value: 'exact' },
  { label: 'Suggested', value: 'suggested' },
];

export default function FilteredPage() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, newToday: 0, exact: 0, suggested: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 350);
  }

  function handleTabChange(val) {
    setActiveTab(val);
    setPage(1);
  }

  function clearFilters() {
    setActiveTab('');
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  }

  const hasFilters = activeTab !== '' || debouncedSearch !== '';

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams({ page, limit: 25 });
    if (activeTab) params.set('type', activeTab);
    if (debouncedSearch) params.set('search', debouncedSearch);
    try {
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? { total: 0, newToday: 0, exact: 0, suggested: 0 });
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    fetchLeads();
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  const totalPages = Math.ceil(total / 25);

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Filtered</h1>
            <p className="page-subtitle">Search and filter leads by type, company, or person</p>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {total} result{total !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="filter-bar">
          <div className="tabs-pill">
            {TABS.map(tab => (
              <button
                key={tab.value}
                className={`tab-pill-btn${activeTab === tab.value ? ' active' : ''}`}
                onClick={() => handleTabChange(tab.value)}
              >
                {tab.label}
                <span className="tab-pill-count">
                  {tab.value === '' ? stats.total : tab.value === 'exact' ? stats.exact : stats.suggested}
                </span>
              </button>
            ))}
          </div>
          <div className="filter-divider" />
          <input
            className={`form-input${debouncedSearch ? ' has-value' : ''}`}
            style={{ width: 240 }}
            placeholder="Search by name, company, email..."
            value={search}
            onChange={handleSearchChange}
          />
          {hasFilters && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="card">
            <div className="skeleton-list">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-row" />)}
            </div>
          </div>
        ) : leads.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              {hasFilters ? 'No leads match your filters.' : 'No leads yet — waiting for new visitors.'}
            </div>
          </div>
        ) : (
          <div>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Company</th>
                      <th>Type</th>
                      <th>Fit Score</th>
                      <th>Engagement</th>
                      <th>Received</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map(lead => (
                      <tr key={lead.id}>
                        <td>
                          <div className="person-cell">
                            <div className="avatar-initials">{getInitials(lead.full_name)}</div>
                            <div>
                              <div style={{ fontWeight: 500 }}>{lead.full_name || '—'}</div>
                              {lead.email && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{lead.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="company-cell">
                            {lead.company_logo_url
                              ? <img className="company-logo" src={lead.company_logo_url} alt="" />
                              : <div className="company-initials">{getInitials(lead.company_name)}</div>
                            }
                            <div>
                              <div style={{ fontWeight: 500 }}>{lead.company_name || '—'}</div>
                              {lead.company_domain && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{lead.company_domain}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          {lead.lead_type ? (
                            <span className={`badge badge-${lead.lead_type}`}>
                              {lead.lead_type.charAt(0).toUpperCase() + lead.lead_type.slice(1)}
                            </span>
                          ) : '—'}
                        </td>
                        <td><ScoreBar value={lead.fit_score} max={30} color="var(--blue-500)" /></td>
                        <td><ScoreBar value={lead.engagement_score} max={20} color="var(--violet-400)" /></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{timeAgo(lead.received_at)}</td>
                        <td>
                          <button className="push-btn" disabled title="Smart Lead integration — Phase 2">
                            Push to Smart Lead
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <button key={p} className={`page-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  );
                })}
                <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>→</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

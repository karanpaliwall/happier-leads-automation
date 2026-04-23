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

function formatDuration(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function toExternalUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

function ColHeader({ label, tip }) {
  const [pos, setPos] = useState(null);
  return (
    <>
      <span
        className="col-header-tip"
        onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: r.left + r.width / 2, y: r.top }); }}
        onMouseLeave={() => setPos(null)}
      >
        {label}
        <span className="col-tip-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </span>
      </span>
      {pos && (
        <div className="col-tip-fixed" style={{ left: Math.min(pos.x, window.innerWidth - 276), top: pos.y - 10, transform: 'translate(-50%, -100%)' }}>
          {tip}
        </div>
      )}
    </>
  );
}

function VerifiedBadge() {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState(null);
  return (
    <>
      <span
        className="verified-badge"
        onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: r.left + r.width / 2, y: r.top }); setShow(true); }}
        onMouseLeave={() => setShow(false)}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Verified
      </span>
      {show && pos && (
        <div className="col-tip-fixed" style={{ left: Math.min(pos.x, window.innerWidth - 276), top: pos.y - 10, transform: 'translate(-50%, -100%)' }}>
          <strong style={{ color: 'var(--green-400)' }}>✓ Waterfall Verified</strong><br />
          Happier Leads has exactly identified this person and confirmed their contact details using their Waterfall verification process. This is a high-confidence exact match.
        </div>
      )}
    </>
  );
}

function DetailItem({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="detail-item">
      <div className="detail-item-label">{label}</div>
      <div className="detail-item-value">{value}</div>
    </div>
  );
}

const DETAIL_CRITERIA_LABELS = {
  employees: 'Company Size', industry: 'Industry', sector: 'Sector', revenue: 'Revenue',
  jobTitle: 'Job Title', seniority: 'Seniority', department: 'Department', hqLocation: 'HQ Location',
  hqCity: 'HQ City', hqState: 'HQ State', companyType: 'Company Type', numberOfVisits: 'Visit Count',
  duration: 'Time on Site', pageVisited: 'Page Visited', visitorCity: 'Visitor City',
  visitorState: 'Visitor State', visitorLocation: 'Visitor Location', campaignSource: 'Campaign Source',
  campaignMedium: 'Campaign Medium', campaignName: 'Campaign Name', campaignTerm: 'Campaign Term',
  technologies: 'Technologies', alexaRank: 'Traffic Rank', keywords: 'Keywords', tag: 'Tag',
  aiSummaryMatching: 'AI Summary',
};

function getCriteriaLabel(detailed) {
  if (!detailed) return 'Criterion';
  const matched = Object.entries(detailed).filter(([, v]) => v != null).map(([k]) => DETAIL_CRITERIA_LABELS[k] || k);
  return matched.length > 0 ? matched.join(' + ') : 'Criterion';
}

function LeadDetailPanel({ lead, colSpan = 8 }) {
  const rp = lead.raw_payload || {};
  const contact = rp.contact || {};
  const company = rp.company || {};
  const scores = Array.isArray(rp.scores) ? rp.scores : [];
  const summary = rp.summary || {};
  const pageVisits = Array.isArray(rp.pageVisits) ? rp.pageVisits : [];
  const utm = rp.utm || {};
  const geo = contact.geo || {};

  const hasContactDetail = contact.businessEmail || contact.personalEmail || contact.position || contact.headline || contact.phone || geo.city;
  const hasCompanyDetail = company.sector || company.industry || company.country || company.employeesRange || company.estimatedAnnualRevenue || company.yearFounded;
  const hasVisitDetail = summary.visits || summary.duration || pageVisits.length > 0 || rp.referrer;
  const hasUtm = utm.source || utm.medium || utm.campaign;

  return (
    <tr className="detail-row">
      <td colSpan={colSpan} className="detail-row-cell">
        <div className="detail-panel">

          {hasContactDetail && (
            <div className="detail-section">
              <h4 className="detail-section-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                Contact Details
              </h4>
              <div className="detail-grid">
                {contact.businessEmail && (
                  <div className="detail-item">
                    <div className="detail-item-label">Business Email</div>
                    <div className="detail-item-value detail-item-row">
                      <span>{contact.businessEmail}</span>
                      {contact.contactType?.toLowerCase().includes('exact') && <VerifiedBadge />}
                    </div>
                  </div>
                )}
                {contact.personalEmail && (
                  <div className="detail-item">
                    <div className="detail-item-label">Personal Email</div>
                    <div className="detail-item-value detail-item-row">
                      <span>{contact.personalEmail}</span>
                      {contact.contactType?.toLowerCase().includes('exact') && <VerifiedBadge />}
                    </div>
                  </div>
                )}
                <DetailItem label="Position" value={contact.position} />
                <DetailItem label="Headline" value={contact.headline} />
                <DetailItem label="Phone" value={contact.phone} />
                {(geo.city || geo.country) && (
                  <DetailItem label="Location" value={[geo.city, geo.state, geo.country].filter(Boolean).join(', ')} />
                )}
                <DetailItem label="Contact Type" value={contact.contactType} />
                {contact.linkedin && (
                  <div className="detail-item">
                    <div className="detail-item-label">LinkedIn</div>
                    <div className="detail-item-value">
                      <a href={toExternalUrl(contact.linkedin)} target="_blank" rel="noopener noreferrer" className="detail-link">{contact.linkedin}</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {hasCompanyDetail && (
            <div className="detail-section">
              <h4 className="detail-section-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                Company Details
              </h4>
              <div className="detail-grid">
                <DetailItem label="Domain" value={company.domain} />
                <DetailItem label="Sector" value={company.sector} />
                <DetailItem label="Industry" value={company.industry} />
                <DetailItem label="Country" value={company.country} />
                <DetailItem label="Employees" value={company.employeesRange} />
                <DetailItem label="Est. Revenue" value={company.estimatedAnnualRevenue} />
                <DetailItem label="Year Founded" value={company.yearFounded} />
                {company.linkedinPage && (
                  <div className="detail-item">
                    <div className="detail-item-label">Company LinkedIn</div>
                    <div className="detail-item-value">
                      <a href={toExternalUrl(company.linkedinPage)} target="_blank" rel="noopener noreferrer" className="detail-link">View Page →</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {scores.length > 0 && (
            <div className="detail-section">
              <h4 className="detail-section-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                Fit Score Breakdown
              </h4>
              <div className="scores-list">
                {scores.map((s, i) => {
                  const score = s.fitScore ?? s.score ?? 0;
                  const ratio = s.fitScoreRatio ?? 0;
                  const category = s.category ?? getCriteriaLabel(s.detailed);
                  if (score === 0 && ratio === 0) return null;
                  return (
                    <div key={i} className="score-breakdown-item">
                      <div className="score-breakdown-header">
                        <span className="score-breakdown-category">{category}</span>
                        <span className="score-breakdown-val">{score} pts</span>
                      </div>
                      <div className="score-bar-detail">
                        <div className="score-fill" style={{ width: `${ratio}%`, background: 'var(--blue-500)' }} />
                      </div>
                      {s.reason && <div className="score-breakdown-reason">{s.reason}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasVisitDetail && (
            <div className="detail-section">
              <h4 className="detail-section-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                Visit Intelligence
              </h4>
              <div className="detail-grid">
                <DetailItem label="Total Visits" value={summary.visits} />
                <DetailItem label="Total Duration" value={formatDuration(summary.duration)} />
                <DetailItem label="First Visit" value={rp.isFirstVisit != null ? (rp.isFirstVisit ? 'Yes' : 'No') : null} />
                <DetailItem label="Referrer" value={rp.referrer} />
                {rp.ip && <DetailItem label="IP Address" value={rp.ip} />}
              </div>
              {pageVisits.length > 0 && (
                <div className="page-visits-list">
                  <div className="page-visits-label">Pages Visited</div>
                  {pageVisits.map((pv, i) => (
                    <div key={i} className="page-visit-item">
                      <span className="page-visit-path">{pv.path}</span>
                      <span className="page-visit-meta">{pv.visitCount}x · {formatDuration(pv.totalTime)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasUtm && (
            <div className="detail-section">
              <h4 className="detail-section-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Attribution (UTM)
              </h4>
              <div className="detail-grid">
                <DetailItem label="Source" value={utm.source} />
                <DetailItem label="Medium" value={utm.medium} />
                <DetailItem label="Campaign" value={utm.campaign} />
                <DetailItem label="Term" value={utm.term} />
                <DetailItem label="Content" value={utm.content} />
              </div>
            </div>
          )}

        </div>
      </td>
    </tr>
  );
}

function LeadRow({ lead }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={`lead-row${expanded ? ' lead-row-expanded' : ''}`}
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer' }}
      >
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="push-btn" disabled title="Smart Lead integration — Phase 2">
              Push to Smart Lead
            </button>
            <span className={`expand-chevron${expanded ? ' expanded' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </span>
          </div>
        </td>
      </tr>
      {expanded && <LeadDetailPanel lead={lead} colSpan={7} />}
    </>
  );
}

function exportCSV(leads) {
  const headers = ['Name', 'Email', 'Company', 'Domain', 'Type', 'Fit Score', 'Engagement Score', 'Received'];
  const rows = leads.map(l => [
    l.full_name || '',
    l.email || '',
    l.company_name || '',
    l.company_domain || '',
    l.lead_type || '',
    l.fit_score ?? '',
    l.engagement_score ?? '',
    l.received_at ? new Date(l.received_at).toLocaleString() : '',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const TABS = [
  { label: 'All Leads', value: '' },
  { label: 'Exact', value: 'exact' },
  { label: 'Suggested', value: 'suggested' },
];

const DEFAULT_STATS = { total: 0, newToday: 0, exact: 0, suggested: 0 };

let _cache = { leads: [], stats: DEFAULT_STATS, total: 0 };

export default function FilteredPage() {
  const [leads, setLeads] = useState(_cache.leads);
  const [total, setTotal] = useState(_cache.total);
  const [stats, setStats] = useState(_cache.stats);
  const [loading, setLoading] = useState(_cache.leads.length === 0);
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
      _cache = { leads: data.leads ?? [], total: data.total ?? 0, stats: data.stats ?? DEFAULT_STATS };
      setLeads(_cache.leads);
      setTotal(_cache.total);
      setStats(_cache.stats);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    fetchLeads();
    const interval = setInterval(fetchLeads, 10000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  const totalPages = Math.ceil(total / 25);

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Leads</h1>
            <p className="page-subtitle">All identified visitors · click any row to expand full details</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} result{total !== 1 ? 's' : ''}</span>
            <button className="export-csv-btn" onClick={() => exportCSV(leads)} disabled={leads.length === 0}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
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
            style={{ flex: 1, minWidth: 160, maxWidth: 320 }}
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
                      <th>
                        <ColHeader
                          label="Fit Score"
                          tip="How well this company matches your Ideal Customer Profile (ICP) — scored by Happier Leads based on industry, size, revenue, and other criteria you've configured. Max 30 pts. Higher = stronger match."
                        />
                      </th>
                      <th>
                        <ColHeader
                          label="Engagement"
                          tip="How actively this visitor engaged with your website. Calculated from number of visits (up to 10 pts) and time spent on site (up to 10 pts). Max 20 pts. Higher = more interested."
                        />
                      </th>
                      <th>Received</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map(lead => (
                      <LeadRow key={lead.id} lead={lead} />
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

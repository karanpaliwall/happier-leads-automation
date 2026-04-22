'use client';
import { useState, useEffect, useCallback } from 'react';
import EmptyState from '@/components/EmptyState';

function ColHeader({ label, tip }) {
  const [pos, setPos] = useState(null);

  function handleMouseEnter(e) {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
  }

  function handleMouseLeave() {
    setPos(null);
  }

  return (
    <>
      <span
        className="col-header-tip"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {label}
        <span className="col-tip-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </span>
      </span>

      {pos && (
        <div
          className="col-tip-fixed"
          style={{
            left: Math.min(pos.x, window.innerWidth - 276),
            top: pos.y - 10,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {tip}
        </div>
      )}
    </>
  );
}

const DEFAULT_STATS = { total: 0, newToday: 0, exact: 0, suggested: 0 };

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

// Ensure any URL opens as an absolute external link
function toExternalUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

const DETAIL_CRITERIA_LABELS = {
  employees: 'Company Size',
  industry: 'Industry',
  sector: 'Sector',
  revenue: 'Revenue',
  jobTitle: 'Job Title',
  seniority: 'Seniority',
  department: 'Department',
  hqLocation: 'HQ Location',
  hqCity: 'HQ City',
  hqState: 'HQ State',
  companyType: 'Company Type',
  numberOfVisits: 'Visit Count',
  duration: 'Time on Site',
  pageVisited: 'Page Visited',
  visitorCity: 'Visitor City',
  visitorState: 'Visitor State',
  visitorLocation: 'Visitor Location',
  campaignSource: 'Campaign Source',
  campaignMedium: 'Campaign Medium',
  campaignName: 'Campaign Name',
  campaignTerm: 'Campaign Term',
  technologies: 'Technologies',
  alexaRank: 'Traffic Rank',
  keywords: 'Keywords',
  tag: 'Tag',
  aiSummaryMatching: 'AI Summary',
};

function getCriteriaLabel(detailed) {
  if (!detailed) return 'Criterion';
  const matched = Object.entries(detailed)
    .filter(([, v]) => v != null)
    .map(([k]) => DETAIL_CRITERIA_LABELS[k] || k);
  return matched.length > 0 ? matched.join(' + ') : 'Criterion';
}

function VerifiedBadge() {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState(null);

  function handleMouseEnter(e) {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
    setShow(true);
  }

  return (
    <>
      <span
        className="verified-badge"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Verified
      </span>
      {show && pos && (
        <div
          className="col-tip-fixed"
          style={{
            left: Math.min(pos.x, window.innerWidth - 276),
            top: pos.y - 10,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <strong style={{ color: 'var(--green-400)' }}>✓ Waterfall Verified</strong>
          <br />
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

function LeadDetailPanel({ lead, colSpan = 7 }) {
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
                      <a href={toExternalUrl(contact.linkedin)} target="_blank" rel="noopener noreferrer" className="detail-link">
                        {contact.linkedin}
                      </a>
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
                      <a href={toExternalUrl(company.linkedinPage)} target="_blank" rel="noopener noreferrer" className="detail-link">
                        View Page →
                      </a>
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

function LeadRow({ lead, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false);

  function handleRowClick() {
    setExpanded(e => !e);
  }

  function handleCheckboxClick(e) {
    e.stopPropagation();
    onToggle(lead.id);
  }

  return (
    <>
      <tr
        className={`lead-row${expanded ? ' lead-row-expanded' : ''}${selected ? ' lead-row-selected' : ''}`}
        onClick={handleRowClick}
        style={{ cursor: 'pointer' }}
      >
        <td className="checkbox-cell" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            className="row-checkbox"
            checked={selected}
            onChange={handleCheckboxClick}
          />
        </td>
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
      {expanded && <LeadDetailPanel lead={lead} colSpan={8} />}
    </>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams({ page, limit: 25 });
    if (typeFilter) params.set('type', typeFilter);
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? DEFAULT_STATS);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, search]);

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 10000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  // Clear selection when leads list changes (page/filter change)
  useEffect(() => { setSelectedIds(new Set()); }, [leads]);

  function toggleOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  }

  async function handleDelete() {
    const ids = Array.from(selectedIds);
    const confirmed = window.confirm(
      `Delete ${ids.length} lead${ids.length !== 1 ? 's' : ''}? This cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      setSelectedIds(new Set());
      await fetchLeads();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = leads.length > 0 && selectedIds.size === leads.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < leads.length;
  const totalPages = Math.ceil(total / 25);

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Leads</h1>
            <p className="page-subtitle">All identified visitors · click any row to expand full details</p>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stats.total} total</div>
        </div>
      </div>

      <div className="page-body">
        <div className="filter-bar">
          <span className="filter-bar-label">Filter</span>
          <div className="filter-divider" />
          <select
            className="form-select"
            style={{ width: 140 }}
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Types</option>
            <option value="exact">Exact</option>
            <option value="suggested">Suggested</option>
          </select>
          <input
            className="form-input"
            style={{ width: 220 }}
            placeholder="Search company or person..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {selectedIds.size > 0 && (
            <button
              className="delete-selected-btn"
              onClick={handleDelete}
              disabled={deleting}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              {deleting ? 'Deleting…' : `Delete ${selectedIds.size} selected`}
            </button>
          )}
        </div>

        {loading ? (
          <div className="card">
            <div className="skeleton-list">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-row" />)}
            </div>
          </div>
        ) : stats.total === 0 && !typeFilter && !search ? (
          <EmptyState />
        ) : leads.length === 0 ? (
          <div className="card">
            <div className="empty-state">No leads match your filters.</div>
          </div>
        ) : (
          <div>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="checkbox-cell">
                        <input
                          type="checkbox"
                          className="row-checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected; }}
                          onChange={toggleAll}
                        />
                      </th>
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
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        selected={selectedIds.has(lead.id)}
                        onToggle={toggleOne}
                      />
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

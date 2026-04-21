'use client';

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

export default function LeadsTable({ leads, total, page, onPageChange }) {
  const totalPages = Math.ceil((total || 0) / 25);

  if (!leads?.length) {
    return (
      <div className="card">
        <div className="empty-state">
          No leads yet — activate your Happier Leads automation and wait for a new visitor.
        </div>
      </div>
    );
  }

  return (
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
                      <span>{lead.full_name || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="company-cell">
                      {lead.company_logo_url
                        ? <img className="company-logo" src={lead.company_logo_url} alt="" />
                        : <div className="company-initials">{getInitials(lead.company_name)}</div>
                      }
                      <span>{lead.company_name || '—'}</span>
                    </div>
                  </td>
                  <td>
                    {lead.lead_type ? (
                      <span className={`badge badge-${lead.lead_type}`}>
                        {lead.lead_type.charAt(0).toUpperCase() + lead.lead_type.slice(1)}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <ScoreBar value={lead.fit_score} max={30} color="var(--blue-500)" />
                  </td>
                  <td>
                    <ScoreBar value={lead.engagement_score} max={20} color="var(--violet-400)" />
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {timeAgo(lead.received_at)}
                  </td>
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
          <button
            className="page-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            ←
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
            if (p < 1 || p > totalPages) return null;
            return (
              <button
                key={p}
                className={`page-btn${p === page ? ' active' : ''}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            );
          })}
          <button
            className="page-btn"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

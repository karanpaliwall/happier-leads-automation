'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Overview',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/leads',
    label: 'Leads',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/filtered',
    label: 'Filter',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
    ),
  },
];

function getPageLabel(pathname) {
  const match = NAV_ITEMS.find(item => item.href === pathname);
  return match ? match.label : 'Pipeline';
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const pathname = usePathname();
  const pageLabel = getPageLabel(pathname);

  return (
    <aside className={`sidebar${open ? ' sidebar-open' : ''}${collapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <div className="sidebar-brand-icon">
            <img
              src="/favicon.png"
              alt="Growleads"
              width="40"
              height="40"
              style={{ objectFit: 'contain', display: 'block' }}
            />
          </div>
          {!collapsed && (
            <div className="sidebar-brand-actions">
              {open && (
                <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
              <button
                className="sidebar-collapse-btn"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {collapsed ? (
          <button
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            style={{ marginTop: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : (
          <div className="sidebar-brand-stack">
            <div className="sidebar-brand-name">Growleads</div>
            <div className="sidebar-brand-sub">{pageLabel}</div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {!collapsed && <p className="sidebar-section-label">Pipeline</p>}
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-item${pathname === item.href ? ' active' : ''}`}
            onClick={onClose}
            title={collapsed ? item.label : undefined}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <span className="dot-green" />
          {!collapsed && (
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--green-400)' }}>Connected</span>
          )}
        </div>
      </div>
    </aside>
  );
}

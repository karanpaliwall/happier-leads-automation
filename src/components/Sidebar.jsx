'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_SECTIONS = [
  {
    label: 'Pipeline',
    items: [
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
        href: '/filtered',
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
    ],
  },
  {
    label: 'Smart Lead',
    hideLabel: true,
    items: [
      {
        href: '/campaigns',
        label: 'Campaigns',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6"  y1="20" x2="6"  y2="14" />
          </svg>
        ),
      },
    ],
  },
];

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const pathname = usePathname();
  // When open as a mobile drawer, always show the full expanded state regardless of
  // the desktop collapsed setting — prevents needing two taps to see nav labels
  const isCollapsed = collapsed && !open;

  return (
    <aside
      className={`sidebar${open ? ' sidebar-open' : ''}${isCollapsed ? ' sidebar-collapsed' : ''}`}
    >
      <div className="sidebar-brand">
        {isCollapsed ? (
          <button
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '4px 0', color: 'var(--text-muted)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        ) : (
          <>
            <div className="sidebar-brand-icon">
              <img
                src="/favicon.png"
                alt="Growleads"
                width="32"
                height="32"
                style={{ objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div className="sidebar-brand-stack">
              <div className="sidebar-brand-name">Growleads</div>
              <div className="sidebar-brand-sub">Website Traffic Signal</div>
            </div>
            {open ? (
              <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
            ) : (
              <button
                className="sidebar-collapse-btn"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                style={{ marginLeft: 'auto' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            {!isCollapsed && !section.hideLabel && <p className="sidebar-section-label">{section.label}</p>}
            {section.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item${pathname === item.href ? ' active' : ''}`}
                onClick={!isCollapsed ? onClose : undefined}
                title={isCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          justifyContent: isCollapsed ? 'center' : 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dot-green" />
            {!isCollapsed && (
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--green-400)' }}>Live</span>
            )}
          </div>
          {!isCollapsed && (
            <Link href="/admin" className="admin-btn" title="Admin Panel">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
              Admin
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Auto-collapse sidebar when viewport is narrow (high zoom or small screen)
    function syncCollapse() {
      if (window.innerWidth < 1100) setCollapsed(true);
    }
    syncCollapse();
    window.addEventListener('resize', syncCollapse);
    return () => window.removeEventListener('resize', syncCollapse);
  }, []);

  // Scroll to top on every page navigation (App Router doesn't do this reliably on mobile)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className={`app-layout${mounted ? ' app-mounted' : ''}`}>
      {/* Full-width mobile header bar — hidden on desktop */}
      <header className="mobile-header">
        <button
          className="mobile-header-menu"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {sidebarOpen && (
        <div className="nav-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />

      <main className={`main-content${collapsed ? ' main-collapsed' : ''}`}>
        {children}
      </main>
    </div>
  );
}

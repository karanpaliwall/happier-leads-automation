'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import EmptyState from '@/components/EmptyState';

const DEFAULT_STATS = { total: 0, newToday: 0, exact: 0, suggested: 0, newTodayExact: 0, newTodaySuggested: 0 };

// Module-level cache — survives tab navigation, shows instantly on remount
let _cache = { leads: [], stats: DEFAULT_STATS, lastReceived: null };

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

function StatCard({ label, value, color, accent, icon, sub }) {
  return (
    <div className="stat-card-v2" style={{ borderTopColor: accent }}>
      <div className="stat-card-v2-top">
        <span className="stat-card-v2-label">{label}</span>
        <span className="stat-card-v2-icon" style={{ color: accent }}>{icon}</span>
      </div>
      <div className="stat-card-v2-value" style={{ color }}>{value}</div>
      {sub}
    </div>
  );
}

export default function OverviewPage() {
  const [leads, setLeads] = useState(_cache.leads);
  const [stats, setStats] = useState(_cache.stats);
  const [loading, setLoading] = useState(_cache.leads.length === 0);
  const [lastReceived, setLastReceived] = useState(_cache.lastReceived);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/leads?limit=5');
      const data = await res.json();
      _cache = {
        leads: data.leads ?? [],
        stats: data.stats ?? DEFAULT_STATS,
        lastReceived: data.leads?.[0]?.received_at ?? null,
      };
      setLeads(_cache.leads);
      setStats(_cache.stats);
      setLastReceived(_cache.lastReceived);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle">Pipeline health and recent lead activity · auto-refreshes every 10s</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        {!loading && stats.total === 0 && <EmptyState />}

        {(loading || stats.total > 0) && <div className="stat-grid-v2">
          <StatCard
            label="Total Leads"
            value={stats.total}
            color="var(--text-primary)"
            accent="var(--blue-500)"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            }
          />
          <StatCard
            label="New Today"
            value={stats.newToday}
            color="var(--blue-400)"
            accent="var(--blue-400)"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            }
            sub={(stats.newTodayExact > 0 || stats.newTodaySuggested > 0) ? (
              <div className="stat-card-breakdown">
                <span style={{ color: 'var(--green-400)' }}>{stats.newTodayExact} Exact</span>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <span style={{ color: 'var(--orange-400)' }}>{stats.newTodaySuggested} Suggested</span>
              </div>
            ) : null}
          />
          <StatCard
            label="Exact Leads"
            value={stats.exact}
            color="var(--green-400)"
            accent="var(--green-400)"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            }
          />
          <StatCard
            label="Suggested"
            value={stats.suggested}
            color="var(--orange-400)"
            accent="var(--orange-400)"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            }
          />
        </div>}

        {!loading && stats.total > 0 && (<div className="overview-grid">
          <div className="card overview-status-card">
            <div className="card-header">
              <h3 className="card-title">Pipeline Status</h3>
            </div>
            <div className="status-rows">
              <div className="status-row">
                <span className="dot-green" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Webhook Active</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    POST /api/webhook/happierleads
                  </div>
                </div>
              </div>
              <div className="status-row">
                <span className="dot-green" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Database Connected</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Neon PostgreSQL · {stats.total} leads stored
                  </div>
                </div>
              </div>
              <div className="status-row">
                <span className="dot-green" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Last Lead Received</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {lastReceived ? timeAgo(lastReceived) : 'No leads yet'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card overview-recent-card">
            <div className="card-header">
              <h3 className="card-title">Recent Leads</h3>
              <Link href="/filtered" className="card-link">View all →</Link>
            </div>

            {loading ? (
              <div className="skeleton-list">
                {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
              </div>
            ) : leads.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No leads yet — waiting for first visitor
              </div>
            ) : (
              <div className="recent-leads-list">
                {leads.map(lead => (
                  <div key={lead.id} className="recent-lead-row">
                    <div className="person-cell">
                      <div className="avatar-initials">{getInitials(lead.full_name)}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                          {lead.full_name || '—'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {lead.company_name || '—'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {lead.lead_type && (
                        <span className={`badge badge-${lead.lead_type}`}>
                          {lead.lead_type.charAt(0).toUpperCase() + lead.lead_type.slice(1)}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 50, textAlign: 'right' }}>
                        {timeAgo(lead.received_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>)}
      </div>
    </>
  );
}

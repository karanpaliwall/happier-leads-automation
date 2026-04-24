'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const CAMPAIGN_NAMES = [];

const MOCK_CLIENTS = [];

function clientInitials(name) {
  return name.split(/[\s_]/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'];

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export default function AdminPage() {
  const [authed, setAuthed]             = useState(false);
  const [password, setPassword]         = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [authError, setAuthError]       = useState('');
  const [authLoading, setAuthLoading]   = useState(false);
  const [mounted, setMounted]           = useState(false);
  const [activeTab, setActiveTab]       = useState('notes');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [selectedCampaign, setSelected] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [noteText, setNoteText]         = useState('');
  const [notes, setNotes]               = useState([]);
  const dropdownRef                     = useRef(null);

  // Client Tags tab state
  const [tagCampaignSearch, setTagCampaignSearch]   = useState('');
  const [tagCampaignSelected, setTagCampaignSel]    = useState('');
  const [showTagDropdown, setShowTagDropdown]        = useState(false);
  const [tagInput, setTagInput]                     = useState('');
  const [tagChips, setTagChips]                     = useState([]);
  const tagDropdownRef                              = useRef(null);

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem('adminAuth') === 'true') setAuthed(true);
    try {
      const saved = localStorage.getItem('adminNotes');
      if (saved) setNotes(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  useEffect(() => {
    if (!showTagDropdown) return;
    function handleClick(e) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target)) setShowTagDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTagDropdown]);

  function handleAuth(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setTimeout(() => {
      if (password === 'Growleads@admin') {
        sessionStorage.setItem('adminAuth', 'true');
        setAuthed(true);
      } else {
        setAuthError('Incorrect password');
        setAuthLoading(false);
      }
    }, 700);
  }

  function handleSaveNote(e) {
    e.preventDefault();
    if (!selectedCampaign || !noteText.trim()) return;
    const note = {
      id: Date.now(),
      campaign: selectedCampaign,
      text: noteText.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    localStorage.setItem('adminNotes', JSON.stringify(updated));
    setNoteText('');
    setSelected('');
    setCampaignSearch('');
  }

  function handleDeleteNote(id) {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    localStorage.setItem('adminNotes', JSON.stringify(updated));
  }

  const filteredCampaigns = CAMPAIGN_NAMES.filter(name =>
    name.toLowerCase().includes(campaignSearch.toLowerCase())
  );

  if (!mounted) return null;

  if (!authed) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 60px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'inline-block', marginBottom: 12, lineHeight: 0 }}>
              <img src="/favicon.png" alt="Growleads" width="52" height="52" style={{ display: 'block', borderRadius: 12 }} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Growleads</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Admin Access</div>
          </div>
          <div className="login-card">
            <form onSubmit={handleAuth}>
              <div className="login-field">
                <label className="login-label">Admin Password</label>
                <div className="login-input-wrap">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="login-input"
                    autoFocus
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon open={showPass} />
                  </button>
                </div>
              </div>
              {authError && <div className="login-error">{authError}</div>}
              <button type="submit" disabled={authLoading || !password} className="login-submit-btn">
                {authLoading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.7s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Signing in…
                  </>
                ) : 'Sign in as Admin'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="admin-panel-header">
        <div className="admin-breadcrumb">
          <Link href="/" className="admin-breadcrumb-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Overview
          </Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span className="admin-panel-title">Admin Panel</span>
        </div>
        <div className="admin-tabs">
          <button
            className={`admin-tab-btn${activeTab === 'notes' ? ' active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            </svg>
            Notes
          </button>
          <button
            className={`admin-tab-btn${activeTab === 'tags' ? ' active' : ''}`}
            onClick={() => setActiveTab('tags')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            Client Tags
            <span className="admin-tab-count">{MOCK_CLIENTS.length}</span>
          </button>
        </div>
        <span className="admin-badge">ADMIN</span>
      </div>

      {activeTab === 'notes' && (
        <div className="admin-notes-layout">
          <div className="admin-notes-left">
            <div className="admin-section-title">
              <div className="admin-section-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                </svg>
              </div>
              Add Note
            </div>

            <div>
              <label className="login-label" style={{ display: 'block', marginBottom: 6 }}>SmartLead Campaign</label>
              <div className="campaign-search-wrap" ref={dropdownRef}>
                <div className="campaign-search-input-wrap">
                  <span className="campaign-search-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </span>
                  <input
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Search by name or ID…"
                    value={selectedCampaign || campaignSearch}
                    onChange={e => {
                      setCampaignSearch(e.target.value);
                      setSelected('');
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                  />
                </div>
                {showDropdown && filteredCampaigns.length > 0 && !selectedCampaign && (
                  <div className="campaign-search-dropdown">
                    {filteredCampaigns.map(name => (
                      <button
                        key={name}
                        className="campaign-search-opt"
                        type="button"
                        onClick={() => {
                          setSelected(name);
                          setCampaignSearch('');
                          setShowDropdown(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedCampaign && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="selected-campaign-pill">
                    {selectedCampaign}
                    <button
                      type="button"
                      onClick={() => { setSelected(''); setCampaignSearch(''); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 0, marginLeft: 2 }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="login-label" style={{ display: 'block', marginBottom: 6 }}>Note</label>
              <textarea
                className="admin-note-textarea"
                placeholder="Enter a note for this campaign…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
              <div className="admin-char-count">{noteText.length} chars</div>
            </div>

            <button
              className="admin-submit-btn"
              onClick={handleSaveNote}
              disabled={!selectedCampaign || !noteText.trim()}
              type="button"
            >
              Save Note
            </button>
          </div>

          <div className="admin-notes-right">
            <div className="admin-section-title" style={{ marginBottom: 16 }}>Saved Notes</div>
            {notes.length === 0 ? (
              <div className="admin-empty-state">
                <div className="admin-empty-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  </svg>
                </div>
                <p className="admin-empty-title">No notes yet</p>
                <p className="admin-empty-sub">Select a campaign and write a note.</p>
              </div>
            ) : (
              <div style={{ overflow: 'auto', flex: 1 }}>
                {notes.map(note => (
                  <div key={note.id} className="admin-note-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div className="admin-note-campaign">{note.campaign}</div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: 4, transition: 'color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--red-400)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                    <div className="admin-note-text">{note.text}</div>
                    <div className="admin-note-date">
                      {new Date(note.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tags' && (
        <div className="admin-notes-layout">
          {/* Left: Add / Edit Tags */}
          <div className="admin-notes-left">
            <div className="admin-section-title">
              <div className="admin-section-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
              </div>
              Add / Edit Tags
            </div>

            {/* Campaign search */}
            <div>
              <label className="login-label" style={{ display: 'block', marginBottom: 6 }}>SmartLead Campaign</label>
              <div className="campaign-search-wrap" ref={tagDropdownRef}>
                <div className="campaign-search-input-wrap">
                  <span className="campaign-search-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </span>
                  <input
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Search by name or ID…"
                    value={tagCampaignSelected || tagCampaignSearch}
                    onChange={e => { setTagCampaignSearch(e.target.value); setTagCampaignSel(''); setShowTagDropdown(true); }}
                    onFocus={() => setShowTagDropdown(true)}
                  />
                </div>
                {showTagDropdown && !tagCampaignSelected && (
                  <div className="campaign-search-dropdown">
                    {CAMPAIGN_NAMES.filter(n => n.toLowerCase().includes(tagCampaignSearch.toLowerCase())).map(name => (
                      <button key={name} className="campaign-search-opt" type="button"
                        onClick={() => { setTagCampaignSel(name); setTagCampaignSearch(''); setShowTagDropdown(false); }}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {tagCampaignSelected && (
                <div style={{ marginTop: 6 }}>
                  <span className="selected-campaign-pill">
                    {tagCampaignSelected}
                    <button type="button" onClick={() => { setTagCampaignSel(''); setTagCampaignSearch(''); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 0, marginLeft: 2 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </span>
                </div>
              )}
            </div>

            {/* Client tag input */}
            <div>
              <label className="login-label" style={{ display: 'block', marginBottom: 6 }}>Client Tags</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="Type a client name, press Enter…"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault();
                      if (!tagChips.includes(tagInput.trim())) setTagChips(v => [...v, tagInput.trim()]);
                      setTagInput('');
                    }
                  }}
                />
                <button
                  type="button"
                  className="admin-submit-btn"
                  style={{ padding: '0 16px', width: 'auto', height: 38 }}
                  onClick={() => {
                    if (tagInput.trim() && !tagChips.includes(tagInput.trim())) {
                      setTagChips(v => [...v, tagInput.trim()]);
                      setTagInput('');
                    }
                  }}
                  disabled={!tagInput.trim()}
                >
                  Add
                </button>
              </div>
              {tagChips.length > 0 && (
                <div className="admin-tags-grid" style={{ marginTop: 10 }}>
                  {tagChips.map(chip => (
                    <div key={chip} className="admin-tag-chip">
                      <span className="admin-tag-dot" style={{ background: '#f59e0b' }} />
                      {chip}
                      <button type="button" onClick={() => setTagChips(v => v.filter(c => c !== chip))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 0, marginLeft: 2, display: 'flex' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="button" className="admin-submit-btn"
              disabled={!tagCampaignSelected || tagChips.length === 0}
              onClick={() => { setTagChips([]); setTagCampaignSel(''); setTagCampaignSearch(''); }}>
              Save Tags
            </button>
          </div>

          {/* Right: Clients list */}
          <div className="admin-notes-right">
            <div className="admin-section-title" style={{ marginBottom: 16 }}>Clients</div>
            {MOCK_CLIENTS.length === 0 ? (
              <div className="admin-empty-state">
                <div className="admin-empty-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                </div>
                <p className="admin-empty-title">No clients yet</p>
                <p className="admin-empty-sub">Add a client tag and save it to a campaign.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {MOCK_CLIENTS.map((client, i) => (
                  <div key={client.name} className="admin-client-row">
                    <div className="admin-client-avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                      {clientInitials(client.name)}
                    </div>
                    <div className="admin-client-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span className="admin-client-name">{client.name}</span>
                        <span className="admin-client-count">{client.campaigns.length} campaign{client.campaigns.length !== 1 ? 's' : ''}</span>
                        <span className="admin-l-badge">L</span>
                      </div>
                      <div className="admin-campaign-pills">
                        {client.campaigns.map(c => (
                          <span key={c} className="admin-campaign-pill-sm">
                            <span className="admin-tag-dot" style={{ background: 'var(--text-muted)', width: 5, height: 5 }} />
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

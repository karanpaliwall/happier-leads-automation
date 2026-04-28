import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const HR_BASE = 'https://api.heyreach.io/api/public';
const TIMEOUT_MS = 8000;

async function hrGet(path, apiKey) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${HR_BASE}${path}`, {
      headers: { 'X-API-KEY': apiKey },
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (res.status === 401) return { __authError: true };
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOneCampaign(id, apiKey) {
  const [infoRes, statsRes] = await Promise.allSettled([
    hrGet(`/Campaign/GetById?campaignId=${id}`, apiKey),
    hrGet(`/Campaign/GetCampaignStatsByCampaignId?campaignId=${id}`, apiKey),
  ]);

  const info = infoRes.value;
  if (info?.__authError) throw new Error('HEYREACH_INVALID_KEY');
  if (!info?.id) return null;

  // Stats may be embedded in info.statistics or come from the dedicated stats endpoint
  const embedded = info.statistics ?? info.stats ?? {};
  const s = (statsRes.status === 'fulfilled' && statsRes.value && !statsRes.value.__authError)
    ? statsRes.value
    : embedded;

  // Normalize status: HeyReach uses IN_PROGRESS for running campaigns
  const rawStatus = (info.status ?? '').toUpperCase();
  const status = rawStatus === 'IN_PROGRESS' ? 'ACTIVE' : rawStatus;

  return {
    id: String(info.id),
    name: info.name ?? `Campaign ${id}`,
    status,
    created: info.createdAt ?? info.created_at ?? null,
    totalLeads:   Number(s.totalLeads   ?? s.total               ?? info.totalLeads   ?? 0),
    invitesSent:  Number(s.connectionRequestsSent ?? s.invitesSent ?? s.invitationsSent ?? embedded.connectionRequestsSent ?? 0),
    accepted:     Number(s.connectionRequestsAccepted ?? s.accepted ?? s.acceptedInvitations ?? embedded.connectionRequestsAccepted ?? 0),
    messagesSent: Number(s.messagesSent ?? s.messages ?? embedded.messagesSent ?? 0),
    replies:      Number(s.repliesReceived ?? s.replies ?? s.totalReplies ?? embedded.repliesReceived ?? 0),
  };
}

export async function GET(request) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  const apiKey = process.env.HEYREACH_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'HEYREACH_API_KEY not configured' }, { status: 500 });

  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);

  if (!ids.length) return NextResponse.json({ campaigns: [], fetchedAt: new Date().toISOString() });

  const results = await Promise.allSettled(ids.map(id => fetchOneCampaign(id, apiKey)));

  // Surface auth errors immediately so the UI can show a clear message
  const invalidKey = results.some(r => r.status === 'rejected' && r.reason?.message === 'HEYREACH_INVALID_KEY');
  if (invalidKey) {
    return NextResponse.json({ error: 'HEYREACH_INVALID_KEY' }, { status: 401 });
  }

  const campaigns = results
    .filter(r => r.status === 'fulfilled' && r.value != null)
    .map(r => r.value);

  return NextResponse.json(
    { campaigns, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store, no-cache' } }
  );
}

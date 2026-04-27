import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SL_BASE = 'https://server.smartlead.ai/api/v1';

async function slFetch(path, apiKey) {
  const res = await fetch(`${SL_BASE}${path}?api_key=${encodeURIComponent(apiKey)}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`SmartLead HTTP ${res.status}`);
  return res.json();
}

async function fetchOneCampaign(id, apiKey) {
  const [infoResult, analyticsResult] = await Promise.allSettled([
    slFetch(`/campaigns/${id}`, apiKey),
    slFetch(`/campaigns/${id}/analytics`, apiKey),
  ]);

  const info = infoResult.status === 'fulfilled' ? infoResult.value : null;
  if (!info?.id) return null;

  const raw = analyticsResult.status === 'fulfilled' ? analyticsResult.value : {};
  // SmartLead returns analytics either at root or nested under `data`
  const a = raw?.data ?? raw ?? {};

  return {
    id:          String(info.id),
    name:        info.name        ?? `Campaign ${id}`,
    status:      (info.status     ?? 'UNKNOWN').toUpperCase(),
    created:     info.created_at  ?? null,
    totalLeads:  a.total_leads            ?? a.total_lead_count      ?? 0,
    completed:   a.completed_count        ?? a.completed             ?? 0,
    inProgress:  a.in_progress_count      ?? a.in_progress           ?? 0,
    yetToStart:  a.not_contacted_count    ?? a.yet_to_start_count    ?? a.not_contacted ?? a.yet_to_start ?? 0,
    blocked:     a.blocked_count          ?? a.blocked               ?? 0,
    sendPending: a.send_pending_count     ?? a.email_send_pending_count ?? a.send_pending ?? 0,
    opens:       a.open_count             ?? a.unique_open_count     ?? a.email_open_count ?? 0,
    replies:     a.reply_count            ?? a.replied_count         ?? 0,
    bounces:     a.bounce_count           ?? a.bounced_count         ?? 0,
    clicks:      a.click_count            ?? a.clicked_count         ?? 0,
  };
}

async function fetchAllIds(apiKey) {
  const res = await fetch(
    `${SL_BASE}/campaigns?api_key=${encodeURIComponent(apiKey)}`,
    { cache: 'no-store' }
  );
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(`SmartLead HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`);
  if (!text) return [];
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`SmartLead returned non-JSON: ${text.slice(0, 120)}`); }
  const list = Array.isArray(data) ? data : (data?.data ?? data?.campaigns ?? []);
  return list.map(c => String(c.id)).filter(Boolean);
}

export async function GET(request) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  const apiKey = process.env.SMARTLEAD_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'SMARTLEAD_API_KEY not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids');

  let ids;
  if (idsParam) {
    ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50);
  } else {
    try {
      ids = (await fetchAllIds(apiKey)).slice(0, 50);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
  }

  if (!ids.length) return NextResponse.json({ campaigns: [], fetchedAt: new Date().toISOString() });

  const results = await Promise.allSettled(ids.map(id => fetchOneCampaign(id, apiKey)));

  const campaigns = results
    .filter(r => r.status === 'fulfilled' && r.value != null)
    .map(r => r.value);

  return NextResponse.json(
    { campaigns, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store, no-cache' } }
  );
}

import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SL_BASE = 'https://server.smartlead.ai/api/v1';
const TIMEOUT_MS = 8000; // abort individual SmartLead calls after 8s

async function slGet(path, apiKey) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${SL_BASE}${path}?api_key=${encodeURIComponent(apiKey)}`,
      { cache: 'no-store', signal: ctrl.signal }
    );
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch { return null; }
  finally { clearTimeout(timer); }
}

async function fetchOneCampaign(id, apiKey) {
  // Two parallel calls per campaign; allSettled so one failure never blocks the other
  const [infoRes, analyticsRes] = await Promise.allSettled([
    slGet(`/campaigns/${id}`, apiKey),
    slGet(`/campaigns/${id}/analytics`, apiKey),
  ]);

  const info = infoRes.value;
  if (!info?.id) return null;

  const raw = analyticsRes.value ?? {};
  const a   = raw?.data ?? raw ?? {};
  const cls = a.campaign_lead_stats ?? {};
  console.log(`[SL audit] campaign ${id} raw analytics:`, JSON.stringify({ a_keys: Object.keys(a), cls_keys: Object.keys(cls), cls, a_counts: { open_count: a.open_count, reply_count: a.reply_count, bounce_count: a.bounce_count, click_count: a.click_count, total_count: a.total_count, unique_sent_count: a.unique_sent_count, pending_count: a.pending_count, sent_count: a.sent_count } }));

  return {
    id:          String(info.id),
    name:        info.name       ?? `Campaign ${id}`,
    status:      (info.status    ?? 'UNKNOWN').toUpperCase(),
    created:     info.created_at ?? null,
    totalLeads:  cls.total      || 0,
    emailsSent:  a.total_count  || a.unique_sent_count || 0,
    completed:   cls.completed  || 0,
    inProgress:  cls.inprogress || 0,
    yetToStart:  cls.notStarted || 0,
    blocked:     cls.blocked    || 0,
    sendPending: cls.notStarted || 0,
    opens:       a.open_count   || a.unique_open_count || 0,
    replies:     a.reply_count  || 0,
    bounces:     a.bounce_count || 0,
    clicks:      a.click_count  || 0,
  };
}

export async function GET(request) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  const apiKey = process.env.SMARTLEAD_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'SMARTLEAD_API_KEY not configured' }, { status: 500 });

  // Only user-added IDs are sent from the frontend; max 20
  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);

  if (!ids.length) return NextResponse.json({ campaigns: [], fetchedAt: new Date().toISOString() });

  // Fire all campaigns in parallel; individual failures return null and are filtered out
  const results  = await Promise.allSettled(ids.map(id => fetchOneCampaign(id, apiKey)));
  const campaigns = results
    .filter(r => r.status === 'fulfilled' && r.value != null)
    .map(r => r.value);

  return NextResponse.json(
    { campaigns, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store, no-cache' } }
  );
}

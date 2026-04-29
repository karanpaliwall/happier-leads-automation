import { requireAuth } from '@/lib/auth';
import sql, { withRetry } from '@/lib/db';
import { NextResponse } from 'next/server';

const HR_BASE = 'https://api.heyreach.io/api/public';

export async function POST(request, { params }) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  const { id } = await params;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { campaignId } = body ?? {};
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const apiKey = process.env.HEYREACH_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'HEYREACH_API_KEY not configured' }, { status: 500 });

  // UUID format guard — prevents PostgreSQL 22P02 error surfacing as misleading 500
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
  }

  // Atomic read + idempotency check — rejects if already pushed to prevent HeyReach duplicates
  const rows = await withRetry(() => sql`
    SELECT id, first_name, last_name, full_name, email, company_name, company_domain, linkedin_url,
           pushed_to_smart_lead
    FROM leads WHERE id = ${id}::uuid
  `);
  if (!rows.length) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const lead = rows[0];
  if (lead.pushed_to_smart_lead) {
    return NextResponse.json({ error: 'Already pushed to HeyReach' }, { status: 409 });
  }

  // Push to HeyReach campaign — 10s timeout to prevent hanging on Vercel
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  let hrRes;
  try {
    hrRes = await fetch(`${HR_BASE}/Campaign/AddLeadsToActiveCampaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        campaignId: Number(campaignId),
        leads: [{
          linkedInProfileUrl: lead.linkedin_url     ?? '',
          firstName:          lead.first_name        ?? '',
          lastName:           lead.last_name          ?? '',
          companyName:        lead.company_name       ?? '',
          companyDomain:      lead.company_domain     ?? '',
          email:              lead.email              ?? '',
        }],
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    console.error('[push] HeyReach fetch failed:', e);
    return NextResponse.json({ error: 'Failed to reach HeyReach' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  if (!hrRes.ok) {
    const errText = await hrRes.text().catch(() => '');
    console.error('[push] HeyReach rejected:', hrRes.status, errText);
    return NextResponse.json(
      { error: `HeyReach rejected the request (HTTP ${hrRes.status})` },
      { status: 502 }
    );
  }

  // Mark as pushed in DB — if this fails, return ok:true anyway (HeyReach already received
  // the lead; a retry would create a duplicate). The DB will be updated on next sync.
  try {
    await withRetry(() => sql`
      UPDATE leads SET pushed_to_smart_lead = true, pushed_at = now() WHERE id = ${id}::uuid
    `);
  } catch (err) {
    console.error('[push] DB update failed after successful HeyReach push — lead may appear un-pushed:', err);
  }

  return NextResponse.json({ ok: true });
}

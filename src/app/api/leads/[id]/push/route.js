import { requireAuth } from '@/lib/auth';
import sql, { withRetry } from '@/lib/db';
import { NextResponse } from 'next/server';

const SL_BASE = 'https://server.smartlead.ai/api/v1';

export async function POST(request, { params }) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  const { id } = await params;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { campaignId } = body ?? {};
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const apiKey = process.env.SMARTLEAD_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'SMARTLEAD_API_KEY not configured' }, { status: 500 });

  // UUID format guard — prevents PostgreSQL 22P02 error surfacing as misleading 500
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
  }

  // Atomic read + idempotency check — rejects if already pushed to prevent SmartLead duplicates
  const rows = await withRetry(() => sql`
    SELECT id, first_name, last_name, full_name, email, company_name, company_domain, linkedin_url,
           pushed_to_smart_lead
    FROM leads WHERE id = ${id}::uuid
  `);
  if (!rows.length) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const lead = rows[0];
  if (lead.pushed_to_smart_lead) {
    return NextResponse.json({ error: 'Already pushed to SmartLead' }, { status: 409 });
  }

  // Push to SmartLead campaign
  const slRes = await fetch(
    `${SL_BASE}/campaigns/${campaignId}/leads?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_list: [{
          email:            lead.email           ?? '',
          first_name:       lead.first_name      ?? '',
          last_name:        lead.last_name        ?? '',
          company_name:     lead.company_name     ?? '',
          website:          lead.company_domain   ?? '',
          linkedin_profile: lead.linkedin_url     ?? '',
        }],
      }),
    }
  );

  if (!slRes.ok) {
    const errText = await slRes.text().catch(() => '');
    console.error('[push] SmartLead rejected:', slRes.status, errText);
    return NextResponse.json(
      { error: `SmartLead rejected the request (HTTP ${slRes.status})` },
      { status: 502 }
    );
  }

  // Mark as pushed in DB
  await withRetry(() => sql`
    UPDATE leads SET pushed_to_smart_lead = true, pushed_at = now() WHERE id = ${id}::uuid
  `);

  return NextResponse.json({ ok: true });
}

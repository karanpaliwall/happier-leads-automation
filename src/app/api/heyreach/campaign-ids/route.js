import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS heyreach_campaign_ids (
      id       TEXT        PRIMARY KEY,
      added_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

export async function GET() {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  try {
    await ensureTable();
    const rows = await sql`SELECT id FROM heyreach_campaign_ids ORDER BY added_at ASC`;
    return NextResponse.json({ ids: rows.map(r => r.id) });
  } catch (err) {
    console.error('[heyreach-campaign-ids] GET error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(request) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? '').trim();
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
  }

  try {
    await ensureTable();
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM heyreach_campaign_ids`;
    if (count >= 20) {
      return NextResponse.json({ error: 'Maximum 20 campaigns allowed' }, { status: 400 });
    }
    await sql`INSERT INTO heyreach_campaign_ids (id) VALUES (${id}) ON CONFLICT DO NOTHING`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[heyreach-campaign-ids] POST error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? '').trim();
  if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });

  try {
    await ensureTable();
    await sql`DELETE FROM heyreach_campaign_ids WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[heyreach-campaign-ids] DELETE error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

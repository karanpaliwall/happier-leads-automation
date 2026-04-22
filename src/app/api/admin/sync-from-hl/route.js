import sql from '@/lib/db';

const HL_API_BASE = 'https://rest-admin.happierleads.com/admin';
const HL_API_KEY  = process.env.HL_API_KEY;

// POST /api/admin/sync-from-hl
// Optional body: { dateFrom: "MM/DD/YYYY", dateTo: "MM/DD/YYYY" }
// Defaults to today if no dates provided.
export async function POST(req) {
  if (!HL_API_KEY) {
    return Response.json({ ok: false, error: 'HL_API_KEY env var not set' }, { status: 500 });
  }

  let dateFrom, dateTo;
  try {
    const body = await req.json().catch(() => ({}));
    dateFrom = body.dateFrom;
    dateTo   = body.dateTo;
  } catch {
    // ignore parse errors — use defaults
  }

  // Default: today
  if (!dateFrom || !dateTo) {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${mm}/${dd}/${yyyy}`;
    dateFrom = dateFrom ?? todayStr;
    dateTo   = dateTo   ?? todayStr;
  }

  // Fetch leads from Happier Leads API
  const url = `${HL_API_BASE}/leads?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;
  let hlLeads;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${HL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return Response.json({ ok: false, error: `HL API ${res.status}: ${text}` }, { status: 502 });
    }
    const data = await res.json();
    // HL API may return { leads: [...] } or [...] directly
    hlLeads = Array.isArray(data) ? data : (data.leads ?? data.data ?? []);
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 502 });
  }

  let inserted = 0;
  let skipped  = 0;

  for (const body of hlLeads) {
    const hlId        = body?.leadId ?? body?._id ?? null;
    const firstName   = body?.contact?.firstName ?? null;
    const lastName    = body?.contact?.lastName  ?? null;
    const fullName    = firstName && lastName
      ? `${firstName} ${lastName}`.trim()
      : firstName ?? lastName ?? null;
    const email       = body?.contact?.businessEmail || body?.contact?.personalEmail || null;
    const rawLinkedin = body?.contact?.linkedin ?? null;
    const linkedinUrl = rawLinkedin
      ? (rawLinkedin.startsWith('http') ? rawLinkedin : `https://${rawLinkedin}`)
      : null;
    const companyName    = body?.company?.name    ?? null;
    const companyDomain  = body?.company?.domain  ?? null;
    const companyLogoUrl = body?.company?.logo    ?? body?.company?.logoUrl ?? null;

    const contactType = body?.contact?.contactType ?? '';
    const leadType    = contactType.toLowerCase().includes('exact') ? 'exact' : 'suggested';

    const scores   = Array.isArray(body?.scores) ? body.scores : [];
    const fitScore = scores.length
      ? scores.reduce((sum, s) => sum + (Number(s.fitScore ?? s.score) || 0), 0)
      : null;

    const visits       = Number(body?.summary?.visits) || 0;
    const durationMs   = Number(body?.summary?.duration) || 0;
    const engagementScore = visits > 0
      ? Math.min(10, visits * 2) + Math.min(10, Math.floor(durationMs / 60000))
      : null;

    const activityAt = body?.summary?.lastSession?.date ?? null;

    // Dedup check — same layered logic as the webhook
    const existing = await sql`
      SELECT id FROM leads
      WHERE
        (${hlId}::text IS NOT NULL AND happier_leads_id = ${hlId})
        OR (${email}::text IS NOT NULL AND email = ${email})
        OR (${linkedinUrl}::text IS NOT NULL AND linkedin_url = ${linkedinUrl})
        OR (
          ${fullName}::text IS NOT NULL AND ${companyName}::text IS NOT NULL
          AND full_name = ${fullName} AND company_name = ${companyName}
        )
      LIMIT 1
    `;

    if (existing.length > 0) { skipped++; continue; }

    await sql`
      INSERT INTO leads (
        happier_leads_id,
        first_name, last_name, full_name, email, linkedin_url,
        company_name, company_domain, company_logo_url,
        lead_type, fit_score, engagement_score, activity_at,
        raw_payload
      ) VALUES (
        ${hlId},
        ${firstName}, ${lastName}, ${fullName}, ${email}, ${linkedinUrl},
        ${companyName}, ${companyDomain}, ${companyLogoUrl},
        ${leadType}, ${fitScore}, ${engagementScore},
        ${activityAt ? new Date(activityAt).toISOString() : null},
        ${JSON.stringify(body)}
      )
    `;
    inserted++;
  }

  return Response.json({ ok: true, fetched: hlLeads.length, inserted, skipped });
}

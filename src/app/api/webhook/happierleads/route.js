import sql from '@/lib/db';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Field extraction — confirmed against real Happier Leads test payload (2026-04-22)
  const hlId       = body?.leadId ?? null;
  const firstName  = body?.contact?.firstName ?? null;
  const lastName   = body?.contact?.lastName  ?? null;
  const fullName   = firstName && lastName
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

  // "Exact Visitor" → 'exact', anything else → 'suggested'
  const contactType = body?.contact?.contactType ?? '';
  const leadType    = contactType.toLowerCase().includes('exact') ? 'exact' : 'suggested';

  // Fit score — real payloads use s.fitScore; HL test payloads use s.score. Try both.
  const scores   = Array.isArray(body?.scores) ? body.scores : [];
  const fitScore = scores.length
    ? scores.reduce((sum, s) => sum + (Number(s.fitScore ?? s.score) || 0), 0)
    : null;

  // Engagement score — not sent by HL. Derived from visit activity (0–20 scale).
  // visits: up to 10 pts (each visit = 2 pts, max 5 visits)
  // time on site: up to 10 pts (each full minute = 1 pt, max 10 min)
  const visits      = Number(body?.summary?.visits) || 0;
  const durationMs  = Number(body?.summary?.duration) || 0;
  const engagementScore = visits > 0
    ? Math.min(10, visits * 2) + Math.min(10, Math.floor(durationMs / 60000))
    : null;

  const rawActivityAt = body?.summary?.lastSession?.date ?? null;
  const activityAt = rawActivityAt && !isNaN(new Date(rawActivityAt)) ? rawActivityAt : null;

  // Duplicate check — layered: HL ID → email → LinkedIn → name+company
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

  if (existing.length > 0) {
    return Response.json({ ok: true, duplicate: true });
  }

  try {
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
        ${leadType},
        ${fitScore},
        ${engagementScore},
        ${activityAt ? new Date(activityAt).toISOString() : null},
        ${JSON.stringify(body)}
      )
    `;
  } catch (err) {
    // 23505 = unique_violation — two webhooks raced past the dedup SELECT simultaneously.
    // Treat as duplicate: return 200 so Happier Leads doesn't retry.
    if (err.code === '23505') {
      return Response.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  return Response.json({ ok: true });
}

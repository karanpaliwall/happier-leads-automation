import sql, { withRetry } from '@/lib/db';

const MAX_BODY_BYTES = 64 * 1024; // 64 KB — generous for any real HL payload

export async function POST(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    // Accept secret via URL query param (?secret=xxx) — compatible with Happier Leads webhook URL config
    // Also accept via x-hl-secret or Authorization header for programmatic callers
    const { searchParams } = new URL(req.url);
    const provided = searchParams.get('secret') || req.headers.get('x-hl-secret') || req.headers.get('authorization');
    if (provided !== secret) {
      console.error('[webhook] Auth failed — WEBHOOK_SECRET is set but the request did not include a matching secret. If this is Happier Leads, update the webhook URL to include ?secret=<value>.');
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[webhook] WEBHOOK_SECRET not set — endpoint is open to unauthenticated requests');
  }

  // Reject oversized payloads before reading the body into memory
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: 'Payload too large' }, { status: 413 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Guard against absurdly large JSON bodies (no Content-Length header path)
  if (JSON.stringify(body).length > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: 'Payload too large' }, { status: 413 });
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

  // Warn if all key identity fields are null — likely a Happier Leads payload format change.
  if (!hlId && !email && !fullName) {
    console.error('[webhook] All key fields null — possible HL payload format change. Keys:', Object.keys(body ?? {}), 'contactKeys:', Object.keys(body?.contact ?? {}));
  }

  // Duplicate check — layered: HL ID → email → LinkedIn → name+company
  let existing;
  try {
    existing = await withRetry(() => sql`
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
    `);
  } catch (err) {
    console.error('[webhook] DB error during dedup check:', err);
    // Return 200 to prevent Happier Leads from retrying — a 500 triggers retry storms
    return Response.json({ ok: false, error: 'DB error' });
  }

  if (existing.length > 0) {
    // Repeat visit — always update to the most recent activity time.
    // Use activityAt from payload if present; fall back to NOW() since HL firing
    // the webhook means the lead was active at this moment regardless of lastSession.date.
    // GREATEST(...) ensures the timestamp never moves backwards on out-of-order delivery.
    const freshAt = activityAt ? new Date(activityAt).toISOString() : new Date().toISOString();
    try {
      await withRetry(() => sql`
        UPDATE leads
        SET
          activity_at      = GREATEST(COALESCE(activity_at, ${freshAt}::timestamptz), ${freshAt}::timestamptz),
          engagement_score = ${engagementScore},
          fit_score        = ${fitScore},
          raw_payload      = ${JSON.stringify(body)}
        WHERE id = ${existing[0].id}
      `);
    } catch (err) {
      console.error('[webhook] DB error during activity update:', err);
    }
    return Response.json({ ok: true, duplicate: true });
  }

  try {
    await withRetry(() => sql`
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
    `);
  } catch (err) {
    // 23505 = unique_violation — two webhooks raced past the dedup SELECT simultaneously.
    // Treat as duplicate: return 200 so Happier Leads doesn't retry.
    if (err.code === '23505') {
      return Response.json({ ok: true, duplicate: true });
    }
    console.error('[webhook] DB error during insert:', err);
    return Response.json({ ok: false, error: 'DB error' }, { status: 500 });
  }

  return Response.json({ ok: true });
}

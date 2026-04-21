import sql from '@/lib/db';

export async function POST() {
  const leads = await sql`
    SELECT id, raw_payload FROM leads WHERE raw_payload IS NOT NULL
  `;

  let updated = 0;

  for (const lead of leads) {
    const rp = lead.raw_payload;

    // Fit score — confirmed field name is 'fitScore'
    const scores = Array.isArray(rp?.scores) ? rp.scores : [];
    const fitScore = scores.length
      ? scores.reduce((sum, s) => sum + (Number(s.fitScore) || 0), 0)
      : null;

    // Engagement — derived from visit activity (0–20 scale)
    const visits     = Number(rp?.summary?.visits) || 0;
    const durationMs = Number(rp?.summary?.duration) || 0;
    const engagementScore = visits > 0
      ? Math.min(10, visits * 2) + Math.min(10, Math.floor(durationMs / 60000))
      : null;

    // Normalize linkedin_url — ensure https:// prefix
    const rawLinkedin = rp?.contact?.linkedin ?? null;
    const linkedinUrl = rawLinkedin
      ? (rawLinkedin.startsWith('http') ? rawLinkedin : `https://${rawLinkedin}`)
      : null;

    await sql`
      UPDATE leads
      SET
        fit_score        = ${fitScore},
        engagement_score = ${engagementScore},
        linkedin_url     = COALESCE(${linkedinUrl}, linkedin_url)
      WHERE id = ${lead.id}
    `;
    updated++;
  }

  return Response.json({ ok: true, updated });
}

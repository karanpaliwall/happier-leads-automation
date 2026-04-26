import sql from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Neon returns date/timestamptz columns as JS Date objects.
// JSON.stringify(Date) → full ISO string, which breaks YYYY-MM-DD comparisons.
// Force to plain strings here so the frontend can use them as keys safely.
const toDay = d => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const toTs  = d => (d instanceof Date ? d.toISOString() : String(d));

export async function GET(req) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const since    = searchParams.get('since')    || null;
  const dateFrom = searchParams.get('dateFrom') || null;
  const dateTo   = searchParams.get('dateTo')   || null;

  try {
    // 24h mode: group by hour
    if (since) {
      const rows = await sql`
        SELECT
          date_trunc('hour', received_at)                        AS period,
          COUNT(*)                                               AS total,
          COUNT(*) FILTER (WHERE lead_type = 'exact')           AS exact,
          COUNT(*) FILTER (WHERE lead_type = 'suggested')       AS suggested
        FROM leads
        WHERE received_at >= ${since}::timestamptz
        GROUP BY 1
        ORDER BY 1
      `;
      return Response.json({
        granularity: 'hour',
        points: rows.map(r => ({
          date:      toTs(r.period),
          total:     parseInt(r.total),
          exact:     parseInt(r.exact),
          suggested: parseInt(r.suggested),
        })),
      });
    }

    // Daily mode — single parameterized query handles all filter combinations
    const rows = await sql`
      SELECT received_at::date AS day,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE lead_type = 'exact') AS exact,
        COUNT(*) FILTER (WHERE lead_type = 'suggested') AS suggested
      FROM leads
      WHERE (${dateFrom}::date IS NULL OR received_at::date >= ${dateFrom}::date)
        AND (${dateTo}::date IS NULL OR received_at::date <= ${dateTo}::date)
      GROUP BY 1 ORDER BY 1
    `;

    return Response.json({
      granularity: 'day',
      points: rows.map(r => ({
        date:      toDay(r.day),
        total:     parseInt(r.total),
        exact:     parseInt(r.exact),
        suggested: parseInt(r.suggested),
      })),
    });
  } catch (err) {
    console.error('[chart] DB error:', err);
    return Response.json({ error: 'DB error' }, { status: 500 });
  }
}

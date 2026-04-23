import sql from '@/lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('dateFrom') || null;
  const dateTo   = searchParams.get('dateTo')   || null;

  const rows = await sql`
    SELECT
      received_at::date                                      AS day,
      COUNT(*)                                               AS total,
      COUNT(*) FILTER (WHERE lead_type = 'exact')           AS exact,
      COUNT(*) FILTER (WHERE lead_type = 'suggested')       AS suggested
    FROM leads
    WHERE (${dateFrom}::date IS NULL OR received_at::date >= ${dateFrom}::date)
      AND (${dateTo}::date   IS NULL OR received_at::date <= ${dateTo}::date)
    GROUP BY day
    ORDER BY day
  `;

  return Response.json({
    points: rows.map(r => ({
      date:      r.day,
      total:     parseInt(r.total),
      exact:     parseInt(r.exact),
      suggested: parseInt(r.suggested),
    })),
  });
}

import sql from '@/lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const since    = searchParams.get('since')    || null; // ISO timestamp — used by 24h mode
  const dateFrom = searchParams.get('dateFrom') || null; // ISO date — used by 7d / custom
  const dateTo   = searchParams.get('dateTo')   || null;

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
        date:      r.period,
        total:     parseInt(r.total),
        exact:     parseInt(r.exact),
        suggested: parseInt(r.suggested),
      })),
    });
  }

  // Daily mode — build WHERE clause based on which filters are present
  let rows;
  if (dateFrom && dateTo) {
    rows = await sql`
      SELECT received_at::date AS day,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE lead_type = 'exact') AS exact,
        COUNT(*) FILTER (WHERE lead_type = 'suggested') AS suggested
      FROM leads
      WHERE received_at::date >= ${dateFrom}::date
        AND received_at::date <= ${dateTo}::date
      GROUP BY 1 ORDER BY 1
    `;
  } else if (dateFrom) {
    rows = await sql`
      SELECT received_at::date AS day,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE lead_type = 'exact') AS exact,
        COUNT(*) FILTER (WHERE lead_type = 'suggested') AS suggested
      FROM leads
      WHERE received_at::date >= ${dateFrom}::date
      GROUP BY 1 ORDER BY 1
    `;
  } else {
    rows = await sql`
      SELECT received_at::date AS day,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE lead_type = 'exact') AS exact,
        COUNT(*) FILTER (WHERE lead_type = 'suggested') AS suggested
      FROM leads
      GROUP BY 1 ORDER BY 1
    `;
  }

  return Response.json({
    granularity: 'day',
    points: rows.map(r => ({
      date:      r.day,
      total:     parseInt(r.total),
      exact:     parseInt(r.exact),
      suggested: parseInt(r.suggested),
    })),
  });
}

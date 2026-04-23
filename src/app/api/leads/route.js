import sql from '@/lib/db';

export async function DELETE(req) {
  let ids;
  try {
    ({ ids } = await req.json());
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ ok: false, error: 'No IDs provided' }, { status: 400 });
  }
  await sql`DELETE FROM leads WHERE id = ANY(${ids}::uuid[])`;
  return Response.json({ ok: true, deleted: ids.length });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'));
  const limit  = Math.min(100, parseInt(searchParams.get('limit') || '25'));
  const type     = searchParams.get('type')     || null;
  const search   = searchParams.get('search')   || null;
  const since    = searchParams.get('since')    || null;
  const dateFrom = searchParams.get('dateFrom') || null;
  const dateTo   = searchParams.get('dateTo')   || null;
  const offset = (page - 1) * limit;
  const searchPattern = search ? `%${search}%` : '%';

  // Two queries instead of three — window function gives filtered total alongside the rows
  const [leads, statsRows] = await Promise.all([
    sql`
      SELECT
        id, received_at, first_name, last_name, full_name, email, linkedin_url,
        company_name, company_domain, company_logo_url,
        lead_type, fit_score, engagement_score, activity_at,
        pushed_to_smart_lead, pushed_at, raw_payload,
        COUNT(*) OVER() AS _total
      FROM leads
      WHERE (${type}::text IS NULL OR lead_type = ${type})
        AND (
          company_name ILIKE ${searchPattern}
          OR full_name  ILIKE ${searchPattern}
        )
        AND (${since}::timestamptz IS NULL OR received_at >= ${since}::timestamptz)
        AND (${dateFrom}::date IS NULL OR received_at::date >= ${dateFrom}::date)
        AND (${dateTo}::date IS NULL OR received_at::date <= ${dateTo}::date)
      ORDER BY received_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    sql`
      SELECT
        COUNT(*)                                                                              AS total,
        COUNT(*) FILTER (WHERE received_at >= CURRENT_DATE)                                 AS new_today,
        COUNT(*) FILTER (WHERE lead_type = 'exact')                                         AS exact_count,
        COUNT(*) FILTER (WHERE lead_type = 'suggested')                                     AS suggested_count,
        COUNT(*) FILTER (WHERE received_at >= CURRENT_DATE AND lead_type = 'exact')         AS new_today_exact,
        COUNT(*) FILTER (WHERE received_at >= CURRENT_DATE AND lead_type = 'suggested')     AS new_today_suggested
      FROM leads
    `,
  ]);

  const total = leads.length > 0 ? parseInt(leads[0]._total) : 0;
  const cleanLeads = leads.map(({ _total, ...l }) => l);

  return Response.json({
    leads: cleanLeads,
    total,
    stats: {
      total:           parseInt(statsRows[0].total),
      newToday:        parseInt(statsRows[0].new_today),
      exact:           parseInt(statsRows[0].exact_count),
      suggested:       parseInt(statsRows[0].suggested_count),
      newTodayExact:   parseInt(statsRows[0].new_today_exact),
      newTodaySuggested: parseInt(statsRows[0].new_today_suggested),
    },
  });
}

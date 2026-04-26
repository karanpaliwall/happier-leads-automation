import sql, { withRetry } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

function formatDuration(ms) {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function esc(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export async function GET(req) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const type     = searchParams.get('type')     || null;
  const search   = searchParams.get('search')   || null;
  const since    = searchParams.get('since')    || null;
  const dateFrom = searchParams.get('dateFrom') || null;
  const dateTo   = searchParams.get('dateTo')   || null;
  const searchPattern = search ? `%${search}%` : '%';

  try {
    const leads = await withRetry(() => sql`
      SELECT *
      FROM leads
      WHERE (${type}::text IS NULL OR lead_type = ${type})
        AND (${search}::text IS NULL
          OR company_name ILIKE ${searchPattern}
          OR full_name    ILIKE ${searchPattern}
          OR email        ILIKE ${searchPattern})
        AND (${since}::timestamptz IS NULL OR received_at >= ${since}::timestamptz)
        AND (${dateFrom}::date IS NULL OR received_at >= ${dateFrom}::date)
        AND (${dateTo}::date IS NULL OR received_at < ${dateTo}::date + INTERVAL '1 day')
      ORDER BY received_at DESC
      LIMIT 10000
    `);

    const headers = [
      'Name', 'Email', 'LinkedIn', 'Company', 'Domain', 'Type',
      'Fit Score', 'Engagement Score', 'Received',
      'Personal Email', 'Position', 'Phone', 'Location', 'Contact Type',
      'Sector', 'Industry', 'Company Country', 'Employees Range', 'Est. Revenue', 'Year Founded',
      'Total Visits', 'Total Duration', 'First Visit', 'Referrer', 'IP Address', 'Pages Visited',
      'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Term',
    ];

    const rows = leads.map(l => {
      const rp      = l.raw_payload || {};
      const contact = rp.contact || {};
      const company = rp.company || {};
      const summary = rp.summary || {};
      const utm     = rp.utm || {};
      const geo     = rp.geo || rp.location || {};
      const location = [geo.city, geo.state, geo.country].filter(Boolean).join(', ');
      const pages = Array.isArray(rp.pageVisits)
        ? rp.pageVisits.map(p => p.url || p.page || p).filter(Boolean).join('; ')
        : '';
      return [
        l.full_name, l.email, l.linkedin_url, l.company_name, l.company_domain, l.lead_type,
        l.fit_score, l.engagement_score,
        l.received_at ? new Date(l.received_at).toLocaleString() : '',
        contact.personalEmail, contact.position, contact.phone, location, contact.contactType,
        company.sector, company.industry, company.country, company.employeesRange,
        company.estimatedAnnualRevenue, company.yearFounded,
        summary.visits, summary.duration ? formatDuration(summary.duration) : '',
        rp.isFirstVisit != null ? (rp.isFirstVisit ? 'Yes' : 'No') : '',
        rp.referrer, rp.ip, pages,
        utm.source, utm.medium, utm.campaign, utm.term,
      ].map(esc);
    });

    const csv = [headers.map(esc).join(','), ...rows.map(r => r.join(','))].join('\n');
    const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[leads/export] DB error:', err);
    return Response.json({ error: 'DB error' }, { status: 500 });
  }
}

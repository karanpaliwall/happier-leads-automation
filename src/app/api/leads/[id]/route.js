import sql, { withRetry } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req, { params }) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: 'Invalid lead ID' }, { status: 400 });
  }
  try {
    const rows = await withRetry(() => sql`
      SELECT * FROM leads WHERE id = ${id}::uuid LIMIT 1
    `);
    if (rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json(rows[0]);
  } catch (err) {
    console.error('[leads/id] DB error:', err);
    return Response.json({ error: 'DB error' }, { status: 500 });
  }
}

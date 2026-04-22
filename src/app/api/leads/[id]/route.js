import sql from '@/lib/db';

export async function GET(req, { params }) {
  const { id } = await params;
  const rows = await sql`
    SELECT * FROM leads WHERE id = ${id}::uuid LIMIT 1
  `;
  if (rows.length === 0) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return Response.json(rows[0]);
}

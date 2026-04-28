import { cookies } from 'next/headers';
import { headers } from 'next/headers';

export async function requireAuth() {
  const expected = process.env.SESSION_TOKEN;
  if (!expected) return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  const cookieStore = await cookies();
  const cookieSession = cookieStore.get('gl_session')?.value;
  // Also accept Authorization: Bearer <token> for programmatic/agent access
  const headerStore = await headers();
  const bearer = headerStore.get('authorization')?.replace(/^Bearer\s+/i, '');
  const session = cookieSession ?? bearer;
  if (session !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

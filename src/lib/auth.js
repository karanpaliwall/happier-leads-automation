import { cookies } from 'next/headers';

export async function requireAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('gl_session')?.value;
  const expected = process.env.SESSION_TOKEN || 'gl-auth-v1';
  if (session !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

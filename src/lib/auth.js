import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { timingSafeEqual } from 'crypto';

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  try {
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length) {
      // Compare against a dummy to avoid short-circuit timing leak
      timingSafeEqual(ab, ab);
      return false;
    }
    return timingSafeEqual(ab, bb);
  } catch { return false; }
}

export async function requireAuth() {
  const expected = process.env.SESSION_TOKEN;
  if (!expected) return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  const cookieStore = await cookies();
  const cookieSession = cookieStore.get('gl_session')?.value;
  // Also accept Authorization: Bearer <token> for programmatic/agent access
  const headerStore = await headers();
  const bearer = headerStore.get('authorization')?.replace(/^Bearer\s+/i, '');
  const session = cookieSession ?? bearer;
  if (!safeEqual(session ?? '', expected)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

import { NextResponse } from 'next/server';

const attempts = new Map();
const LIMIT = 10;
const WINDOW_MS = 60_000;

function clientIp(req) {
  // Use the LAST entry in X-Forwarded-For — that's the one added by Vercel's infrastructure
  // and cannot be spoofed by the client (the first entry can be freely injected).
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return 'unknown';
}

export async function POST(request) {
  const ip = clientIp(request);
  const now = Date.now();
  const state = attempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (state.resetAt < now) { state.count = 0; state.resetAt = now + WINDOW_MS; }
  state.count++;
  attempts.set(ip, state);
  if (state.count > LIMIT) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  const loginPassword = process.env.LOGIN_PASSWORD;
  const sessionToken  = process.env.SESSION_TOKEN;
  if (!loginPassword || !sessionToken) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const { password } = body ?? {};

  const { timingSafeEqual } = await import('crypto');
  const passwordMatch = password && timingSafeEqual(Buffer.from(password), Buffer.from(loginPassword));
  if (!passwordMatch) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('gl_session', sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}

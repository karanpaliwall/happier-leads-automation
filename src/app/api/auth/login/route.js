import { NextResponse } from 'next/server';

const attempts = new Map();
const LIMIT = 10;
const WINDOW_MS = 60_000;

function clientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
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

  const { password } = await request.json();

  if (password !== loginPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('gl_session', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
  return response;
}

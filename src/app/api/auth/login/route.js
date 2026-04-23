import { NextResponse } from 'next/server';

export async function POST(request) {
  const { password } = await request.json();

  if (password !== 'Growleads@admin') {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('gl_session', 'gl-auth-v1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

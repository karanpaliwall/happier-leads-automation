import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'gl_session';
const SESSION_VALUE = 'gl-auth-v1';

export function middleware(request) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session !== SESSION_VALUE) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon\\.png|api/webhook|api/auth|login).*)'],
};

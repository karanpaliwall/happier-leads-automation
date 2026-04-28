import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'gl_session';
const SESSION_VALUE = process.env.SESSION_TOKEN;

export function middleware(request) {
  if (!SESSION_VALUE) return NextResponse.redirect(new URL('/login', request.url));
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session !== SESSION_VALUE) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Exclude all /api/* — those routes have their own requireAuth() which returns 401 JSON
  // and also support Authorization: Bearer for programmatic access.
  // Middleware only redirects browser page navigation to /login.
  matcher: ['/((?!_next|favicon\\.png|api|login).*)'],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all API routes, static files, and login page
  if (pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') ||
      pathname === '/favicon.ico' ||
      pathname === '/first-run' ||
      pathname.includes('.')) {
    return NextResponse.next();
  }

  // For all other routes, check if user has a valid token
  const token = request.cookies.get('authToken')?.value;

  // Special handling for the login page: if already authenticated, send to home
  if (pathname === '/login') {
  // If no cookie, allow access to login; if cookie exists, send to home
  if (!token) return NextResponse.next();
  return NextResponse.redirect(new URL('/', request.url));
  }

  // If no users exist yet, allow accessing first-run
  // We cannot query DB in middleware, so rely on redirect from /first-run page itself.
  // If user is unauthenticated and requests /first-run, allow.
  if (!token && pathname === '/first-run') {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
  '/((?!api/|_next/static|_next/image|favicon.ico).*)',
  ],
};

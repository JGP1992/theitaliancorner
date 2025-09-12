import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthService } from './lib/auth';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const token = request.cookies.get('authToken')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const user = AuthService.verifyToken(token);
      if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      // Check if user has admin or manager role
      if (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'manager')) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../../../../lib/auth';

export async function GET(req: NextRequest) {
  // Only allow this debug endpoint in development to avoid leaking cookie details
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }
  const cookieHeader = req.headers.get('cookie') || '';
  const authToken = req.cookies.get('authToken')?.value || null;
  const user = authToken ? AuthService.verifyToken(authToken) : null;

  return NextResponse.json({
    cookieHeader,
    hasAuthCookie: Boolean(authToken),
    authCookieLength: authToken ? authToken.length : 0,
    tokenValid: Boolean(user),
    user: user
      ? {
          id: user.id,
          email: user.email,
          roles: user.roles,
          permissions: user.permissions,
        }
      : null,
  });
}

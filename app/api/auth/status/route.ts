import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../../../../lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;

    if (!token) {
      return NextResponse.json({
        authenticated: false,
        user: null
      });
    }

    const user = AuthService.verifyToken(token);

    if (!user) {
      // Clear invalid token
      const response = NextResponse.json({
        authenticated: false,
        user: null
      });
      response.cookies.set('authToken', '', {
        expires: new Date(0),
        path: '/'
      });
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Auth check failed:', error);
    return NextResponse.json({
      authenticated: false,
      user: null
    });
  }
}

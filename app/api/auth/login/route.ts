import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../../../../lib/auth';

export async function POST(req: NextRequest) {
  try {
  const contentType = req.headers.get('content-type') || '';
  const wantsJson = contentType.includes('application/json');

    let email = '';
    let password = '';
    let rememberMe = false;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      email = body.email;
      password = body.password;
      rememberMe = Boolean(body.rememberMe);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      email = String(form.get('email') || '');
      password = String(form.get('password') || '');
      rememberMe = String(form.get('rememberMe') || '') === 'on' || String(form.get('rememberMe') || '') === 'true';
    } else {
      // Fallback: try formData for unknown/empty types
      try {
        const form = await req.formData();
        email = String(form.get('email') || '');
        password = String(form.get('password') || '');
        rememberMe = String(form.get('rememberMe') || '') === 'on' || String(form.get('rememberMe') || '') === 'true';
      } catch {
        // ignore
      }
    }

    if (!email || !password) {
      const wantsJsonEarly = (req.headers.get('content-type') || '').includes('application/json');
      if (!wantsJsonEarly) {
        const url = new URL('/login', req.url);
        url.searchParams.set('error', 'Email and password are required');
        return NextResponse.redirect(url);
      }
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await AuthService.authenticateUser(email, password);

    if (!user) {
      if (!wantsJson) {
        const url = new URL('/login', req.url);
        url.searchParams.set('error', 'Invalid email or password');
        return NextResponse.redirect(url);
      }
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = AuthService.generateToken(user);

  // wantsJson already computed above

    // If the request came from fetch/json, return JSON. Otherwise, redirect.
    const res = wantsJson
      ? NextResponse.json({
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roles: user.roles,
          },
          token,
        })
      : NextResponse.redirect(new URL('/', req.url), { status: 303 });

    const maxAge = rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 24; // 7d or 1d
    res.cookies.set('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

  return res;

  } catch (error) {
    console.error('Login error:', error);
    // For non-JSON form posts, redirect back to login with error message
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const url = new URL('/login', req.url);
      url.searchParams.set('error', 'Login failed');
      return NextResponse.redirect(url);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../../../../lib/auth';
import { prisma } from '../../../../app/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Registration guard: allow if explicitly enabled, or if no users exist (first-admin bootstrap),
    // or if a valid BOOTSTRAP_TOKEN is provided in header 'x-bootstrap-token'.
    const allowPublic = (process.env.ALLOW_PUBLIC_REGISTRATION || '').toLowerCase() === 'true';
    const totalUsers = await prisma.user.count();
    const hasUsers = totalUsers > 0;
    const bootstrapToken = process.env.BOOTSTRAP_TOKEN?.trim();
    const providedToken = req.headers.get('x-bootstrap-token')?.trim();
    if (!allowPublic) {
      const tokenOk = bootstrapToken && providedToken && bootstrapToken === providedToken;
      const firstAdminOk = !hasUsers; // allow creating the very first user without token
      if (!firstAdminOk && !tokenOk) {
        return NextResponse.json({ error: 'Registration disabled' }, { status: 403 });
      }
    }

    const { email, password, firstName, lastName, roleIds } = await req.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, password, firstName, and lastName are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    const user = await AuthService.createUser(email, password, firstName, lastName, roleIds || []);

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

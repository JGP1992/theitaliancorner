import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Restrict to admins or a dedicated permission
    const isAdmin = AuthService.hasRole(user, 'admin') || AuthService.hasPermission(user, 'audit:read');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const take = Math.min(parseInt(searchParams.get('take') || '50', 10), 200);
    const cursor = searchParams.get('cursor');

  const logs = await (prisma as any).auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const nextCursor = logs.length === take ? logs[logs.length - 1].id : null;

    return NextResponse.json({ logs, nextCursor });
  } catch (err) {
    console.error('Failed to fetch audit logs', err);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user || (!AuthService.hasRole(user, 'admin') && !AuthService.hasRole(user, 'manager'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

  // Extract id from the URL pathname: /api/flavors/{id}
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 1];
    const body = await req.json();
    const { name, unit, targetText, targetNumber, isActive, sortOrder, defaultQuantity } = body || {};

    const data: any = {};
    if (typeof name === 'string') data.name = name.trim();
    if (unit === null || typeof unit === 'string') data.unit = unit?.trim() || null;
    if (targetText === null || typeof targetText === 'string') data.targetText = targetText?.trim() || null;
    if (typeof targetNumber === 'number' || targetNumber === null) data.targetNumber = targetNumber;
    if (typeof sortOrder === 'number') data.sortOrder = sortOrder;
    if (typeof isActive === 'boolean') data.isActive = isActive;

    if (Object.keys(data).length > 0) {
      await prisma.item.update({ where: { id }, data: data as any });
    }
    if (typeof defaultQuantity === 'number' || defaultQuantity === null) {
      await (prisma as any).item.update({ where: { id }, data: { defaultQuantity } });
    }

    const updated = await prisma.item.findUnique({ where: { id }, select: { id: true, name: true, unit: true, targetText: true, targetNumber: true, sortOrder: true, isActive: true } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/flavors/[id] failed:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

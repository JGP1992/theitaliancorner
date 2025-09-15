import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasPermission(user, 'production:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    const where: any = {};
    if (start || end) {
      where.date = {};
      if (start) where.date.gte = new Date(start);
      if (end) where.date.lte = new Date(end);
    }

  const tasks = await (prisma as any).productionTask.findMany({
      where,
      include: {
        item: { include: { category: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ date: 'asc' }, { status: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching production tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasPermission(user, 'production:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { date, itemId, quantity, unit, notes, assignedToUserId } = body || {};
    if (!date || !itemId || typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json({ error: 'date, itemId, and quantity are required' }, { status: 400 });
    }

  const created = await (prisma as any).productionTask.create({
      data: {
        date: new Date(date),
        itemId,
        quantity,
        unit: unit || 'units',
        notes: notes || null,
        createdByUserId: user.id,
        assignedToUserId: assignedToUserId || null,
      },
      include: {
        item: { include: { category: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return NextResponse.json({ task: created }, { status: 201 });
  } catch (error) {
    console.error('Error creating production task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

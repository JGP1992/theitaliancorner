import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to read deliveries
    if (!AuthService.hasPermission(user, 'deliveries:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const plans = await prisma.deliveryPlan.findMany({
      where: date ? { date: new Date(date) } : undefined,
      include: { store: true, items: { include: { item: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deliveries' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to create deliveries
    if (!AuthService.hasPermission(user, 'deliveries:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { storeSlug, date, items, status } = body as {
      storeSlug: string;
      date: string;
      status?: 'DRAFT' | 'CONFIRMED' | 'SENT';
      items: { itemId: string; quantity: number; note?: string }[];
    };
    if (!storeSlug || !date || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const created = await prisma.deliveryPlan.create({
      data: {
        storeId: store.id,
        date: new Date(date),
        status: status && ['DRAFT','CONFIRMED','SENT'].includes(status) ? (status as 'DRAFT'|'CONFIRMED'|'SENT') : 'DRAFT',
        items: { createMany: { data: items.map((i) => ({ itemId: i.itemId, quantity: i.quantity, note: i.note })) } },
      },
      include: { items: true },
    });
    return NextResponse.json(created);
  } catch (error) {
    console.error('Error creating delivery:', error);
    return NextResponse.json(
      { error: 'Failed to create delivery' },
      { status: 500 }
    );
  }
}

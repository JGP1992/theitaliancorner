import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { AuthService } from '../../../lib/auth';
import { logAudit } from '../../../lib/audit';

type OrderItemInput = { itemId: string; quantity: number };

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!AuthService.hasPermission(user, 'deliveries:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const before = searchParams.get('before');

    const where: any = {};
    if (after || before) {
      where.date = {};
      if (after) where.date.gte = new Date(after);
      if (before) where.date.lte = new Date(before);
    }

    const plans = await prisma.deliveryPlan.findMany({
      where,
      include: {
        items: { include: { item: { include: { category: true } } } },
        customers: { include: { customer: true } },
        store: true,
      },
      orderBy: { date: 'desc' }
    });

    // Only return those that are customer-based (no storeId but with customers) for clarity
    const restaurantOrders = plans.filter(p => !p.storeId && p.customers.length > 0);
    return NextResponse.json(restaurantOrders);
  } catch (err) {
    console.error('Failed to fetch restaurant orders', err);
    return NextResponse.json({ error: 'Failed to fetch restaurant orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!AuthService.hasPermission(user, 'deliveries:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { date, status, customerIds, items } : { date: string; status?: 'CONFIRMED'|'DRAFT'; customerIds: string[]; items: OrderItemInput[] } = body;

    if (!date || !Array.isArray(customerIds) || customerIds.length === 0 || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'date, customerIds, and items are required' }, { status: 400 });
    }

    const plan = await prisma.deliveryPlan.create({
      data: {
        date: new Date(date),
        status: status || 'CONFIRMED',
        customers: {
          create: customerIds.map((cid) => ({ customerId: cid }))
        },
        items: {
          create: items.map((it) => ({ itemId: it.itemId, quantity: it.quantity }))
        }
      },
      include: {
        items: { include: { item: { include: { category: true } } } },
        customers: { include: { customer: true } },
      }
    });

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'create',
      resource: 'restaurant-order',
      resourceId: plan.id,
      metadata: { customers: customerIds.length, items: items.length, status: plan.status },
      ip: req.headers.get('x-forwarded-for') || (req as any).ip || null,
      userAgent: req.headers.get('user-agent'),
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    console.error('Failed to create restaurant order', err);
    return NextResponse.json({ error: 'Failed to create restaurant order' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { AuthService } from '../../../../lib/auth';

// Returns daily movement breakdown for a single item within a date range
// Query params: itemId (required), from (YYYY-MM-DD optional), to (YYYY-MM-DD optional)
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasPermission(user, 'stocktakes:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const from = fromParam ? new Date(fromParam) : new Date();
    if (!fromParam) from.setHours(0,0,0,0);
    const to = toParam ? new Date(toParam) : new Date(from.getTime());
    to.setHours(23,59,59,999);

    // Fetch orders (incoming)
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['PENDING','CONFIRMED'] },
        expectedDate: { gte: from, lte: to },
        items: { some: { itemId } }
      },
      include: { items: true }
    });

    // Fetch deliveries (outgoing)
    const deliveries = await prisma.deliveryPlan.findMany({
      where: { status: 'CONFIRMED', date: { gte: from, lte: to }, items: { some: { itemId } } },
      include: { items: true }
    });

    // Fetch productions (production usage)
    const productions = await prisma.production.findMany({
      where: { producedAt: { gte: from, lte: to }, ingredients: { some: { itemId } } },
      include: { ingredients: true }
    });

    // Build a map date -> { incoming, outgoing, production }
    const dayKey = (d: Date) => d.toISOString().slice(0,10);
    const stats: Record<string, { incoming: number; outgoing: number; production: number }> = {};

    // Helper ensure day entry
    const ensure = (dStr: string) => { if (!stats[dStr]) stats[dStr] = { incoming:0, outgoing:0, production:0 }; return stats[dStr]; };

    for (const o of orders) {
      const dStr = dayKey(o.expectedDate as any as Date);
      const entry = ensure(dStr);
      for (const it of o.items) if (it.itemId === itemId) entry.incoming += it.quantity;
    }
    for (const d of deliveries) {
      const dStr = dayKey(d.date as any as Date);
      const entry = ensure(dStr);
      for (const it of d.items) if (it.itemId === itemId) entry.outgoing += it.quantity;
    }
    for (const p of productions) {
      const dStr = dayKey(p.producedAt as any as Date);
      const entry = ensure(dStr);
      for (const ing of p.ingredients) if (ing.itemId === itemId) entry.production += ing.quantityUsed;
    }

    // Expand any missing days in the inclusive range
    const cursor = new Date(from.getTime());
    while (cursor <= to) {
      ensure(dayKey(cursor));
      cursor.setDate(cursor.getDate()+1);
    }

    const days = Object.entries(stats)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v, net: v.incoming - v.outgoing + v.production }));

    return NextResponse.json({ itemId, from: from.toISOString(), to: to.toISOString(), days });
  } catch (e) {
    console.error('Item history error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

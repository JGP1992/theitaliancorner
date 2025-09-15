import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '@/lib/auth';

// Simple analytics: per-store upcoming deliveries, gelato flavor totals, inventory snapshot, and lead-time risk
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
    const days = parseInt(searchParams.get('days') || '7', 10);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + days);
    end.setHours(23, 59, 59, 999);

    const plans = await prisma.deliveryPlan.findMany({
      where: {
        date: { gte: start, lte: end },
        status: { in: ['DRAFT', 'CONFIRMED'] },
      },
      include: {
        store: true,
        customers: { include: { customer: true } },
        items: { include: { item: { include: { category: true } } } },
      },
      orderBy: { date: 'asc' },
    });

    // Aggregate per store
    const perStore: Record<string, { storeId: string; storeName: string; days: Record<string, { totalItems: number; gelatoTubs: number }>; totals: { totalPlans: number; totalItems: number; gelatoTubs: number } } > = {};
    const gelatoTotals: Record<string, number> = {};

    for (const p of plans) {
      const dateKey = p.date.toISOString().slice(0, 10);
      const storeName = p.store?.name || (p.customers.length > 0 ? p.customers.map(pc => pc.customer.name).join(', ') : 'Unknown');
      const storeKey = p.store?.id || `C:${storeName}`;
      if (!perStore[storeKey]) {
        perStore[storeKey] = { storeId: storeKey, storeName, days: {}, totals: { totalPlans: 0, totalItems: 0, gelatoTubs: 0 } };
      }
      const s = perStore[storeKey];
      s.totals.totalPlans += 1;
      if (!s.days[dateKey]) s.days[dateKey] = { totalItems: 0, gelatoTubs: 0 };
      for (const di of p.items) {
        s.days[dateKey].totalItems += di.quantity;
        s.totals.totalItems += di.quantity;
        if (di.item.category?.name === 'Gelato Flavors') {
          s.days[dateKey].gelatoTubs += di.quantity;
          s.totals.gelatoTubs += di.quantity;
          gelatoTotals[di.item.name] = (gelatoTotals[di.item.name] || 0) + di.quantity;
        }
      }
    }

    // Inventory snapshot: last stocktakes per store
    const recentStocktakes = await prisma.stocktake.findMany({
      orderBy: { submittedAt: 'desc' },
      take: 30,
      include: { store: true, items: { include: { item: { include: { category: true } } } } },
    });

    const inventory: Array<{ store: string; items: Array<{ item: string; category: string; qty: number }> }> = [];
    for (const st of recentStocktakes) {
      inventory.push({
        store: st.store.name,
        items: st.items.filter(i => i.quantity != null).map(i => ({ item: i.item.name, category: i.item.category?.name || 'Unknown', qty: i.quantity || 0 })),
      });
    }

    // Lead time risk (placeholder): mark flavors with high upcoming demand
    const leadTimeRisk = Object.entries(gelatoTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([flavor, qty]) => ({ flavor, qty, risk: qty > 20 ? 'HIGH' : qty > 10 ? 'MEDIUM' : 'LOW' }));

    return NextResponse.json({ perStore: Object.values(perStore), gelatoTotals, inventory, leadTimeRisk, range: { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) } });
  } catch (error) {
    console.error('production-analytics error', error);
    return NextResponse.json({ error: 'Failed to compute production analytics' }, { status: 500 });
  }
}

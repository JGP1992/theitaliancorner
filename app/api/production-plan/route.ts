import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Auth
    const token = request.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AuthService.hasPermission(user, 'production:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.max(1, Math.min(60, parseInt(searchParams.get('days') || '7', 10) || 7));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + days);
    end.setHours(23, 59, 59, 999);

    // Fetch delivery plans in range
    const plans = await prisma.deliveryPlan.findMany({
      where: { date: { gte: start, lte: end } },
      include: {
        store: true,
        customers: { include: { customer: true } },
        items: {
          include: {
            item: { include: { category: true } },
            packagingOption: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Build production requirements from Gelato Flavors
    type Prod = {
      flavorName: string;
      totalTubs: number;
      deliveries: Array<{ date: string; destination: string; quantity: number; status: string }>; 
    };
    const prodMap = new Map<string, Prod>();
    for (const p of plans) {
      const destination = p.store?.name || p.customers.map((pc) => pc.customer.name).join(', ') || 'Unknown';
      for (const it of p.items) {
        const cat = it.item.category?.name || '';
        if (cat !== 'Gelato Flavors') continue;
        // Count quantity as tubs to produce; packaging may vary but quantity is in tubs in this domain
        const key = it.item.name;
        if (!prodMap.has(key)) {
          prodMap.set(key, { flavorName: key, totalTubs: 0, deliveries: [] });
        }
        const rec = prodMap.get(key)!;
        rec.totalTubs += it.quantity;
        rec.deliveries.push({
          date: p.date.toISOString(),
          destination,
          quantity: it.quantity,
          status: p.status,
        });
      }
    }
    const productionPlan = Array.from(prodMap.values()).sort((a, b) => a.flavorName.localeCompare(b.flavorName));

    // Inventory snapshot: use the latest stocktake per store and sum across stores
    const stores = await prisma.store.findMany();
    // Fetch latest stocktake with items for each store, but for Factory prefer the latest master stocktake if available
    const latestByStore: Array<{
      store: { id: string; name: string };
      date: Date;
      items: Array<{ item: { id: string; name: string; category: { name: string } }; quantity: number | null }>;
    }> = [];
    for (const s of stores) {
      // Try master stocktake first for Factory
      let st = await prisma.stocktake.findFirst({
        where: { storeId: s.id, ...(s.slug === 'factory' ? { isMaster: true as any } : {}) },
        orderBy: { date: 'desc' },
        include: { items: { include: { item: { include: { category: true } } } } },
      });
      if (!st) {
        st = await prisma.stocktake.findFirst({
          where: { storeId: s.id },
          orderBy: { date: 'desc' },
          include: { items: { include: { item: { include: { category: true } } } } },
        });
      }
      if (st) {
        latestByStore.push({ store: { id: s.id, name: s.name }, date: st.date, items: st.items.map((i) => ({ item: i.item as any, quantity: i.quantity })) });
      }
    }

    type Inv = {
      itemName: string;
      category: string;
      totalQuantity: number;
      lastUpdated: string;
      stocktakes: Array<{ store: string; quantity: number; date: string }>;
      // Optional thresholds if available in store inventory config
      targetThreshold?: number;
    };
    const invMap = new Map<string, Inv>();
    for (const entry of latestByStore) {
      for (const si of entry.items) {
        if (si.quantity == null) continue;
        const name = si.item.name;
        const cat = si.item.category?.name || 'Unknown';
        if (!invMap.has(name)) {
          invMap.set(name, { itemName: name, category: cat, totalQuantity: 0, lastUpdated: entry.date.toISOString(), stocktakes: [] });
        }
        const rec = invMap.get(name)!;
        rec.totalQuantity += si.quantity || 0;
        // Update lastUpdated if newer
        if (new Date(rec.lastUpdated) < entry.date) rec.lastUpdated = entry.date.toISOString();
        rec.stocktakes.push({ store: entry.store.name, quantity: si.quantity || 0, date: entry.date.toISOString().slice(0, 10) });
      }
    }

    // Attach optional thresholds from store inventory settings if present
    const allStoreInventory = await prisma.storeInventory.findMany({ include: { item: true, store: true } });
    const thresholdByItem: Record<string, number | undefined> = {};
    for (const inv of allStoreInventory) {
      if (typeof inv.targetQuantity === 'number') {
        const name = inv.item.name;
        thresholdByItem[name] = Math.max(thresholdByItem[name] || 0, inv.targetQuantity);
      }
    }
    for (const [name, rec] of invMap.entries()) {
      if (thresholdByItem[name] != null) {
        (rec as any).targetThreshold = thresholdByItem[name];
      }
    }

    const inventory = Array.from(invMap.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));

    const summary = {
      totalFlavors: productionPlan.length,
      totalTubs: productionPlan.reduce((s, r) => s + r.totalTubs, 0),
      upcomingDeliveries: plans.length,
    };

    return NextResponse.json({
      productionPlan,
      inventory,
      dateRange: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
      summary,
    });
  } catch (error) {
    console.error('Error in production-plan:', error);
    return NextResponse.json({ error: 'Failed to build production plan' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { AuthService } from '../../../../lib/auth';

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

    // Check if user has permission to read inventory
    if (!AuthService.hasPermission(user, 'stocktakes:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse optional baselineMode (auto | master | latest)
    const { searchParams } = new URL(req.url);
    const baselineModeParam = searchParams.get('baselineMode');
    const baselineMode: 'auto' | 'master' | 'latest' = (baselineModeParam === 'master' || baselineModeParam === 'latest') ? baselineModeParam : 'auto';

    // Get all items with their categories
    const items = await prisma.item.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' }
      ]
    });

    // Prefer current stock from the latest Factory master stocktake if available; otherwise fall back to recent stocktakes
    const factoryStore = await prisma.store.findUnique({ where: { slug: 'factory' } });
    let factoryMaster: (typeof prisma.stocktake) | null = null as any;
    let baseline: 'master' | 'latest' = 'latest';
    let baselineDate: string | null = null;

    let latestStocktakes: Array<any> = [];

    if (factoryStore) {
      if (baselineMode !== 'latest') {
        // attempt master usage / creation (auto or master mode)
        let master = await prisma.stocktake.findFirst({
          where: ({ storeId: factoryStore.id, isMaster: true } as any),
          include: { items: { include: { item: true } }, store: true },
          orderBy: { date: 'desc' },
        });
        if (master) {
          factoryMaster = master as any;
          baseline = 'master';
          baselineDate = master.date?.toISOString?.() ?? null;
        } else if (baselineMode === 'master' || baselineMode === 'auto') {
          // Only auto-create if user explicitly wants master or auto mode (not latest)
            latestStocktakes = await prisma.stocktake.findMany({
              include: { items: { include: { item: true } }, store: true },
              orderBy: { date: 'desc' },
              take: 50
            });
            const baselineMap: Record<string, number> = {};
            if (latestStocktakes.length > 0) {
              for (const st of latestStocktakes) {
                for (const sti of st.items) {
                  if (baselineMap[sti.itemId] == null && typeof sti.quantity === 'number') baselineMap[sti.itemId] = sti.quantity;
                }
              }
            }
            for (const it of items) if (baselineMap[it.id] == null) baselineMap[it.id] = 0;
            try {
              master = await prisma.stocktake.create({
                data: {
                  storeId: factoryStore.id,
                  date: new Date(),
                  // @ts-ignore
                  isMaster: true,
                  notes: 'Auto-created initial master snapshot',
                  submittedByUserId: (user as any).id ?? null,
                  items: { create: Object.entries(baselineMap).map(([itemId, quantity]) => ({ itemId, quantity })) }
                } as any,
                include: { items: { include: { item: true } }, store: true }
              });
              if (master) {
                factoryMaster = master as any;
                baseline = 'master';
                baselineDate = (master as any).date ? new Date((master as any).date).toISOString() : null;
              }
            } catch (e) {
              console.warn('Failed auto-create master snapshot:', e);
            }
        }
      }
    }

    if ((!factoryMaster || baselineMode === 'latest') && latestStocktakes.length === 0) {
      latestStocktakes = await prisma.stocktake.findMany({
        include: { items: { include: { item: true } }, store: true },
        orderBy: { date: 'desc' },
        take: 50
      });
    }

    // If baselineMode explicitly latest, override baseline selection
    if (baselineMode === 'latest') {
      factoryMaster = null as any; // ignore master even if present
      baseline = 'latest';
      if (latestStocktakes.length > 0) baselineDate = latestStocktakes[0].date.toISOString();
    }

    // Date range (defaults to today)
  const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const from = fromParam ? new Date(fromParam) : new Date();
    if (!fromParam) from.setHours(0,0,0,0); // ensure start of day when defaulting
    const to = toParam ? new Date(toParam) : new Date(from.getTime());
    // inclusive end-of-day: set to end of 'to' day
    to.setHours(23,59,59,999);

    const dateRange = { from: from.toISOString(), to: to.toISOString() };
    const partialWindow = baselineDate ? (new Date(baselineDate) > from) : false;

    // Build day boundaries for queries (gte from, lt to+1ms handled by setting end-of-day)

    const incomingOrders = await prisma.order.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        expectedDate: { gte: from, lte: to }
      },
      include: {
        items: {
          include: { item: true }
        }
      }
    });

    // Get outgoing deliveries (confirmed delivery plans in range)
    const outgoingDeliveries = await prisma.deliveryPlan.findMany({
      where: {
        status: 'CONFIRMED',
        date: { gte: from, lte: to }
      },
      include: {
        items: {
          include: { item: true }
        }
      }
    });

    // Get production usage in range
    const todaysProductions = await prisma.production.findMany({
      where: {
        producedAt: { gte: from, lte: to }
      },
      include: {
        ingredients: {
          include: { item: true }
        }
      }
    });

    // Build a quick lookup from the master stocktake if present
    const masterMap: Record<string, number> = {};
    if (factoryMaster) {
      for (const sti of (factoryMaster as any).items ?? []) {
        if (sti?.itemId) masterMap[sti.itemId] = typeof sti.quantity === 'number' ? sti.quantity : 0;
      }
    }

    // Calculate inventory data for each item
    const inventoryData = items.map((item: { id: string; name: string; category: { name: string }; targetNumber: number | null; unit: string | null }) => {
      // Baseline (master or latest) quantity
      let baselineQuantity = 0;
      if (factoryMaster && masterMap[item.id] != null) {
        baselineQuantity = masterMap[item.id] || 0;
      } else if (latestStocktakes.length > 0) {
        const latestStocktakeItem = latestStocktakes
          .flatMap((st: { items: { itemId: string; quantity: number | null }[] }) => st.items)
          .find((sti: { itemId: string; quantity: number | null }) => sti.itemId === item.id);
        baselineQuantity = latestStocktakeItem?.quantity || 0;
      }

      // Movement components
      const incomingQuantity = incomingOrders
        .flatMap((order: { items: { itemId: string; quantity: number }[] }) => order.items)
        .filter((orderItem: { itemId: string; quantity: number }) => orderItem.itemId === item.id)
        .reduce((sum: number, orderItem: { itemId: string; quantity: number }) => sum + orderItem.quantity, 0);

      const outgoingQuantity = outgoingDeliveries
        .flatMap((delivery: { items: { itemId: string; quantity: number }[] }) => delivery.items)
        .filter((deliveryItem: { itemId: string; quantity: number }) => deliveryItem.itemId === item.id)
        .reduce((sum: number, deliveryItem: { itemId: string; quantity: number }) => sum + deliveryItem.quantity, 0);

      const productionUsage = todaysProductions
        .flatMap((production: { ingredients: { itemId: string; quantityUsed: number }[] }) => production.ingredients)
        .filter((ingredient: { itemId: string; quantityUsed: number }) => ingredient.itemId === item.id)
        .reduce((sum: number, ingredient: { itemId: string; quantityUsed: number }) => sum + ingredient.quantityUsed, 0);

      const netMovement = incomingQuantity - outgoingQuantity + productionUsage;
      const derivedCurrent = baselineQuantity + netMovement;

      // Determine status based on derived current vs target
      let status: 'low' | 'normal' | 'high' | 'critical' = 'normal';
      const targetStock = item.targetNumber || 10; // Default target if not set

      if (derivedCurrent === 0) {
        status = 'critical';
      } else if (derivedCurrent < targetStock * 0.25) {
        status = 'critical';
      } else if (derivedCurrent < targetStock * 0.5) {
        status = 'low';
      } else if (derivedCurrent > targetStock * 2) {
        status = 'high';
      }

      return {
        id: item.id,
        name: item.name,
        category: item.category.name,
        baselineQuantity,
        derivedCurrent,
        unit: item.unit || 'units',
        incoming: incomingQuantity,
        outgoing: outgoingQuantity,
        production: productionUsage,
        netMovement,
        targetStock,
        status
      };
    });

    // Calculate summary statistics
    const summary = {
      totalItems: inventoryData.length,
      lowStockItems: inventoryData.filter((item: any) => item.status === 'low').length,
      outOfStockItems: inventoryData.filter((item: any) => item.status === 'critical').length,
      incomingToday: inventoryData.reduce((sum: number, item: any) => sum + item.incoming, 0),
      outgoingToday: inventoryData.reduce((sum: number, item: any) => sum + item.outgoing, 0),
      productionToday: inventoryData.reduce((sum: number, item: any) => sum + item.production, 0),
      dateRange
    };

    const movementSummary = {
      baselineTotal: inventoryData.reduce((sum: number, item: any) => sum + item.baselineQuantity, 0),
      netMovementTotal: inventoryData.reduce((sum: number, item: any) => sum + item.netMovement, 0),
      derivedCurrentTotal: inventoryData.reduce((sum: number, item: any) => sum + item.derivedCurrent, 0),
      incomingTotal: summary.incomingToday,
      outgoingTotal: summary.outgoingToday,
      productionTotal: summary.productionToday
    };

    return NextResponse.json({
      inventory: inventoryData,
      summary,
      baseline,
      baselineDate,
      movementSummary,
      dateRange,
      partialWindow
    , baselineMode });
  } catch (error) {
    console.error('Error fetching inventory dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

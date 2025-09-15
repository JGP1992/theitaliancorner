import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { AuthService } from '../../../../../lib/auth';
import { logAudit } from '../../../../../lib/audit';

interface ReceivedItemInput {
  // Accept either the actual itemId or the order item id for flexibility
  itemId?: string;
  orderItemId?: string;
  receivedQuantity: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  // Optional: get user for audit
  const token = request.cookies.get('authToken')?.value;
  const user = token ? AuthService.verifyToken(token) : null;
  const body = await request.json();
  const { receivedItems }: { receivedItems: ReceivedItemInput[] } = body;
    const { id } = await params;

    if (!receivedItems || !Array.isArray(receivedItems)) {
      return NextResponse.json(
        { error: 'Received items are required' },
        { status: 400 }
      );
    }

    // Get the order with its items
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: {
              include: {
                category: true
              }
            }
          }
        },
        supplier: true
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status === 'RECEIVED') {
      return NextResponse.json(
        { error: 'Order has already been received' },
        { status: 400 }
      );
    }

    // Normalize received items: map to actual item IDs
    const normalized: { itemId: string; receivedQuantity: number }[] = [];
    const orderItemsById = new Map(order.items.map(oi => [oi.id, oi] as const));
    const orderItemByItemId = new Map(order.items.map(oi => [oi.itemId, oi] as const));

    for (const ri of receivedItems) {
      let actualItemId: string | undefined = ri.itemId;
      if (!actualItemId && ri.orderItemId) {
        actualItemId = orderItemsById.get(ri.orderItemId)?.itemId;
      }
      // If still not found, try if provided itemId was actually an orderItemId
      if (!actualItemId && ri.itemId && orderItemsById.has(ri.itemId)) {
        actualItemId = orderItemsById.get(ri.itemId)!.itemId;
      }
      // Validate that this item belongs to the order
      if (!actualItemId || !orderItemByItemId.has(actualItemId)) {
        continue; // skip unknown items rather than failing the whole request
      }
      const qty = typeof ri.receivedQuantity === 'number' && ri.receivedQuantity > 0 ? ri.receivedQuantity : 0;
      if (qty <= 0) continue;
      normalized.push({ itemId: actualItemId, receivedQuantity: qty });
    }

    if (normalized.length === 0) {
      return NextResponse.json(
        { error: 'No valid received items provided' },
        { status: 400 }
      );
    }

    // Update order status and received date
    await prisma.order.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedDate: new Date()
      }
    });

    // Create a stocktake entry for the received items
    // We'll use a default store for factory stocktakes - you might want to make this configurable
  const stores = await prisma.store.findMany({ take: 1 });
    if (stores.length === 0) {
      return NextResponse.json(
        { error: 'No stores found - please create a store first' },
        { status: 400 }
      );
    }

  // Prefer a store with slug 'factory' if present; fallback to the first store
  const factoryStore = (await prisma.store.findFirst({ where: { slug: 'factory' } })) || stores[0]; // Use the first store as factory

    // Create stocktake with received quantities
  const receiptStocktake = await prisma.stocktake.create({
      data: {
        storeId: factoryStore.id,
        date: new Date(),
        notes: `Stock receipt for order ${order.id} from ${order.supplier?.name || 'Unknown Supplier'}`,
    ...(user?.id ? { submittedByUserId: user.id } : {}),
        items: {
          create: normalized.map((receivedItem) => ({
            itemId: receivedItem.itemId,
            quantity: receivedItem.receivedQuantity,
            note: `Received from order ${order.id}`
          }))
        }
      }
    });

    // Auto-schedule delivery to stores based on deficits
    // Date: next day
    const deliverDate = new Date();
    deliverDate.setDate(deliverDate.getDate() + 1);
    deliverDate.setHours(0, 0, 0, 0);

    // Fetch all active stores excluding factory
    const allStores = await prisma.store.findMany();
    const nonFactoryStores = allStores.filter(s => s.id !== factoryStore.id);

    // Get StoreInventory targets for items received
  const itemIds = normalized.map(ri => ri.itemId);
    const targets = await prisma.storeInventory.findMany({
      where: { itemId: { in: itemIds }, isActive: true },
      select: { storeId: true, itemId: true, targetQuantity: true }
    });

    // Build latest stocktake quantities for each store and item
    const latestStocktakes = await prisma.stocktake.findMany({
      where: { storeId: { in: nonFactoryStores.map(s => s.id) } },
      include: { items: true, store: true },
      orderBy: { submittedAt: 'desc' },
      take: 200
    });

    // Build a map: storeId-itemId -> currentQty
    const currentByStoreItem = new Map<string, number>();
    for (const st of latestStocktakes) {
      for (const sti of st.items) {
        const key = `${st.storeId}|${sti.itemId}`;
        if (!currentByStoreItem.has(key)) {
          currentByStoreItem.set(key, sti.quantity ?? 0);
        }
      }
    }

    // For each received item, compute deficits per store and allocate available qty
    const remainingByItem: Record<string, number> = {};
    for (const ri of normalized) {
      remainingByItem[ri.itemId] = (remainingByItem[ri.itemId] || 0) + ri.receivedQuantity;
    }

    // Helper: get target for a store/item
    const targetMap = new Map<string, number>();
    for (const t of targets) {
      const key = `${t.storeId}|${t.itemId}`;
      if (typeof t.targetQuantity === 'number') {
        targetMap.set(key, t.targetQuantity);
      }
    }

    // Prepare per-store delivery items
    type PlanItems = { [itemId: string]: number };
    const storePlan: Record<string, PlanItems> = {};

    for (const store of nonFactoryStores) {
      const planItems: PlanItems = {};
      for (const ri of normalized) {
        const key = `${store.id}|${ri.itemId}`;
        const target = targetMap.get(key);
        if (!target || target <= 0) continue;
        const current = currentByStoreItem.get(key) ?? 0;
        const deficit = Math.max(target - current, 0);
        if (deficit <= 0) continue;
        const avail = remainingByItem[ri.itemId] || 0;
        if (avail <= 0) continue;
        const toAllocate = Math.min(deficit, avail);
        if (toAllocate > 0) {
          planItems[ri.itemId] = (planItems[ri.itemId] || 0) + toAllocate;
          remainingByItem[ri.itemId] -= toAllocate;
        }
      }
      if (Object.keys(planItems).length > 0) {
        storePlan[store.id] = planItems;
      }
    }

    // Upsert DeliveryPlans and DeliveryItems for each store
    for (const [storeId, itemsMap] of Object.entries(storePlan)) {
      // Find or create plan for date
      let plan = await prisma.deliveryPlan.findFirst({
        where: { storeId, date: deliverDate },
      });
      if (!plan) {
        plan = await prisma.deliveryPlan.create({
          data: {
            storeId,
            date: deliverDate,
            status: 'DRAFT',
            notes: `Auto-scheduled after receipt ${order.id}`,
          }
        });
      }

      // Upsert items on the plan
      for (const [itemId, qty] of Object.entries(itemsMap)) {
        const existing = await prisma.deliveryItem.findFirst({ where: { planId: plan.id, itemId } });
        if (existing) {
          await prisma.deliveryItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + qty } });
        } else {
          await prisma.deliveryItem.create({ data: { planId: plan.id, itemId, quantity: qty } });
        }
      }
    }

    // Audit: auto-schedule deliveries
    await logAudit({
      userId: user?.id,
      userEmail: user?.email,
      action: 'auto-schedule',
      resource: 'deliveries',
      resourceId: order.id,
      metadata: { receiptStocktakeId: receiptStocktake.id, scheduledStores: Object.keys(storePlan).length },
      ip: request.headers.get('x-forwarded-for') || (request as any).ip || null,
      userAgent: request.headers.get('user-agent'),
    });

    // Audit log: order received
    await logAudit({
      userId: user?.id,
      userEmail: user?.email,
      action: 'receive',
      resource: 'orders',
      resourceId: id,
      metadata: { items: receivedItems },
      ip: request.headers.get('x-forwarded-for') || (request as any).ip || null,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
  message: 'Stock receipt recorded successfully; deliveries auto-scheduled where possible',
      orderId: id
    });

  } catch (error) {
    console.error('Failed to record stock receipt:', error);
    return NextResponse.json(
      { error: 'Failed to record stock receipt' },
      { status: 500 }
    );
  }
}

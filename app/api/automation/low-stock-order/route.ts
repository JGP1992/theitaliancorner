import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { AuthService } from '../../../../lib/auth';
import { logAudit } from '../../../../lib/audit';

// Aggregates inventory across stores and compares to summed StoreInventory targets
// Creates a draft purchase order with items needed to bring factory+stores up to target.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = AuthService.verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!AuthService.hasPermission(user, 'orders:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Pull StoreInventory targets
    const si = await prisma.storeInventory.findMany({
      where: { isActive: true },
      select: { itemId: true, targetQuantity: true }
    });
    const targetSum: Record<string, number> = {};
    for (const r of si) {
      if (r.targetQuantity != null) {
        targetSum[r.itemId] = (targetSum[r.itemId] || 0) + Number(r.targetQuantity);
      }
    }

    // Aggregate on-hand from latest stocktakes (recent window)
    const stocktakes = await prisma.stocktake.findMany({
      orderBy: { submittedAt: 'desc' },
      take: 50,
      include: { items: true }
    });
    const onHand: Record<string, number> = {};
    for (const st of stocktakes) {
      for (const it of st.items) {
        onHand[it.itemId] = (onHand[it.itemId] || 0) + (it.quantity || 0);
      }
    }

    // Determine deficits
    const deficits: { itemId: string; deficit: number }[] = [];
    for (const [itemId, target] of Object.entries(targetSum)) {
      const have = onHand[itemId] || 0;
      const diff = Math.max(target - have, 0);
      if (diff > 0) deficits.push({ itemId, deficit: diff });
    }

    if (deficits.length === 0) {
      return NextResponse.json({ message: 'No deficits detected. No order needed.' });
    }

    // Create a draft order without supplier; UI can assign later
    const order = await prisma.order.create({
      data: {
        status: 'DRAFT',
        items: {
          create: deficits.map((d) => ({ itemId: d.itemId, quantity: d.deficit, unit: 'units' }))
        }
      },
      include: { items: true }
    });

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'create',
      resource: 'orders',
      resourceId: order.id,
      metadata: { auto: true, deficits: deficits.length },
      ip: req.headers.get('x-forwarded-for') || (req as any).ip || null,
      userAgent: req.headers.get('user-agent'),
    });

    return NextResponse.json({ message: 'Draft order created from deficits', order }, { status: 201 });
  } catch (err) {
    console.error('Automation low-stock order error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

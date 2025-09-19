import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { AuthService } from '../../../../lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to delete stores
    if (!AuthService.hasPermission(user, 'stores:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { slug } = await params;

    // Check if store exists
    const store = await prisma.store.findUnique({
      where: { slug },
      include: {
        stocktakes: true,
        deliveryPlans: true,
        inventory: true,
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Delete associated records first (cascade delete)
    // Note: Prisma schema should handle cascading deletes, but we'll do it explicitly for clarity

    // Delete stocktakes
    await prisma.stocktake.deleteMany({
      where: { storeId: store.id },
    });

    // Delete delivery plans and their items
    const deliveryPlans = await prisma.deliveryPlan.findMany({
      where: { storeId: store.id },
      select: { id: true },
    });

    for (const plan of deliveryPlans) {
      await prisma.deliveryItem.deleteMany({
        where: { planId: plan.id },
      });
      await prisma.deliveryPlan.delete({
        where: { id: plan.id },
      });
    }

    // Delete store inventory
    await prisma.storeInventory.deleteMany({
      where: { storeId: store.id },
    });

    // Finally, delete the store
    await prisma.store.delete({
      where: { id: store.id },
    });

    return NextResponse.json({ message: 'Store deleted successfully' });
  } catch (error) {
    console.error('Error deleting store:', error);
    return NextResponse.json(
      { error: 'Failed to delete store' },
      { status: 500 }
    );
  }
}
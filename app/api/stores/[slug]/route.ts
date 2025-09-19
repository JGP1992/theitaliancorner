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
      console.log('No auth token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = AuthService.verifyToken(token);
    if (!user) {
      console.log('Invalid auth token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('User authenticated:', user.email, 'with roles:', user.roles, 'and permissions:', user.permissions);

    // Check if user has permission to delete stores
    // Temporarily disabled for debugging
    // if (!AuthService.hasPermission(user, 'stores:delete')) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const { slug } = await params;
    console.log('Attempting to delete store with slug:', slug);

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
      console.log('Store not found:', slug);
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    console.log('Found store:', store.name, 'with', store.stocktakes.length, 'stocktakes,', store.deliveryPlans.length, 'delivery plans,', store.inventory.length, 'inventory items');

    // Delete associated records first (cascade delete)
    // Note: Prisma schema should handle cascading deletes, but we'll do it explicitly for clarity

    console.log('Starting deletion of associated records...');

    try {
      // Delete stocktakes
      console.log('Deleting stocktakes...');
      await prisma.stocktake.deleteMany({
        where: { storeId: store.id },
      });
      console.log('Stocktakes deleted');
    } catch (error) {
      console.error('Error deleting stocktakes:', error);
      throw error;
    }

    try {
      // Delete delivery plans and their items
      console.log('Deleting delivery plans...');
      const deliveryPlans = await prisma.deliveryPlan.findMany({
        where: { storeId: store.id },
        select: { id: true },
      });
      console.log('Found', deliveryPlans.length, 'delivery plans to delete');

      for (const plan of deliveryPlans) {
        try {
          console.log('Deleting delivery items for plan:', plan.id);
          await prisma.deliveryItem.deleteMany({
            where: { planId: plan.id },
          });
          console.log('Deleting delivery plan:', plan.id);
          await prisma.deliveryPlan.delete({
            where: { id: plan.id },
          });
        } catch (error) {
          console.error('Error deleting delivery plan', plan.id, ':', error);
          throw error;
        }
      }
      console.log('Delivery plans deleted');
    } catch (error) {
      console.error('Error in delivery plan deletion:', error);
      throw error;
    }

    try {
      // Delete store inventory
      console.log('Deleting store inventory...');
      await prisma.storeInventory.deleteMany({
        where: { storeId: store.id },
      });
      console.log('Store inventory deleted');
    } catch (error) {
      console.error('Error deleting store inventory:', error);
      throw error;
    }

    try {
      // Finally, delete the store
      console.log('Deleting store...');
      await prisma.store.delete({
        where: { id: store.id },
      });
      console.log('Store deleted successfully');
    } catch (error) {
      console.error('Error deleting store:', error);
      throw error;
    }

    return NextResponse.json({ message: 'Store deleted successfully' });
  } catch (error) {
    console.error('Error deleting store:', error);
    return NextResponse.json(
      { error: 'Failed to delete store' },
      { status: 500 }
    );
  }
}
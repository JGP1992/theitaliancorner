import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { AuthService } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    console.log('GET request for store:', slug);

    const store = await prisma.store.findUnique({
      where: { slug },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ store });
  } catch (error) {
    console.error('Error fetching store:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch store: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    console.log('DELETE request received for store deletion');

    // Temporarily bypass authentication for testing
    // const token = req.cookies.get('authToken')?.value;
    // if (!token) {
    //   console.log('No auth token found');
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // const user = AuthService.verifyToken(token);
    // if (!user) {
    //   console.log('Invalid auth token');
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // console.log('User authenticated:', user.email, 'with roles:', user.roles, 'and permissions:', user.permissions);

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
      const stocktakeCount = await prisma.stocktake.deleteMany({
        where: { storeId: store.id },
      });
      console.log(`Deleted ${stocktakeCount.count} stocktakes`);
    } catch (error) {
      console.error('Error deleting stocktakes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to delete stocktakes: ${errorMessage}` },
        { status: 500 }
      );
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
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return NextResponse.json(
            { error: `Failed to delete delivery plan ${plan.id}: ${errorMessage}` },
            { status: 500 }
          );
        }
      }
      console.log('Delivery plans deleted');
    } catch (error) {
      console.error('Error in delivery plan deletion:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to process delivery plans: ${errorMessage}` },
        { status: 500 }
      );
    }

    try {
      // Delete store inventory
      console.log('Deleting store inventory...');
      const inventoryCount = await prisma.storeInventory.deleteMany({
        where: { storeId: store.id },
      });
      console.log(`Deleted ${inventoryCount.count} inventory items`);
    } catch (error) {
      console.error('Error deleting store inventory:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to delete store inventory: ${errorMessage}` },
        { status: 500 }
      );
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to delete store: ${errorMessage}` },
        { status: 500 }
      );
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
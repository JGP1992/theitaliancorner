import { prisma } from './app/lib/prisma.ts';

async function testStoreDeletion() {
  try {
    console.log('Testing store deletion...');

    // Get all stores
    const stores = await prisma.store.findMany();
    console.log('Found stores:', stores.map(s => ({ id: s.id, name: s.name, slug: s.slug })));

    if (stores.length === 0) {
      console.log('No stores found to delete');
      return;
    }

    // Try to delete the first store
    const storeToDelete = stores[0];
    console.log('Attempting to delete store:', storeToDelete.name);

    // Check related records
    const stocktakes = await prisma.stocktake.findMany({
      where: { storeId: storeToDelete.id }
    });
    console.log('Store has', stocktakes.length, 'stocktakes');

    const deliveryPlans = await prisma.deliveryPlan.findMany({
      where: { storeId: storeToDelete.id }
    });
    console.log('Store has', deliveryPlans.length, 'delivery plans');

    const inventory = await prisma.storeInventory.findMany({
      where: { storeId: storeToDelete.id }
    });
    console.log('Store has', inventory.length, 'inventory items');

    // Try the deletion
    console.log('Starting deletion process...');

    // Delete stocktakes
    await prisma.stocktake.deleteMany({
      where: { storeId: storeToDelete.id },
    });
    console.log('Stocktakes deleted');

    // Delete delivery plans
    for (const plan of deliveryPlans) {
      await prisma.deliveryItem.deleteMany({
        where: { planId: plan.id },
      });
      await prisma.deliveryPlan.delete({
        where: { id: plan.id },
      });
    }
    console.log('Delivery plans deleted');

    // Delete inventory
    await prisma.storeInventory.deleteMany({
      where: { storeId: storeToDelete.id },
    });
    console.log('Inventory deleted');

    // Delete store
    await prisma.store.delete({
      where: { id: storeToDelete.id },
    });
    console.log('Store deleted successfully!');

  } catch (error) {
    console.error('Error during deletion:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testStoreDeletion();
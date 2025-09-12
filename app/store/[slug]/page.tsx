import { prisma } from '@/app/lib/prisma';
import StocktakeForm from './stocktake-form';

interface DeliveryPlanWithItems {
  id: string;
  date: Date;
  items: Array<{
    quantity: number;
    item: {
      id: string;
      name: string;
      category: {
        name: string;
      };
      isActive: boolean;
    };
  }>;
}

interface CategoryWithItems {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    isActive: boolean;
    categoryId: string;
    unit: string | null;
    targetNumber: number | null;
    targetText: string | null;
    sortOrder: number;
  }>;
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return <div>Store not found</div>;

  // Get ALL delivery history for this store to determine available gelato flavors
  // (not just recent - stores may have leftover stock from previous deliveries)
  const deliveryPlans: DeliveryPlanWithItems[] = await prisma.deliveryPlan.findMany({
    where: {
      storeId: store.id,
      status: { in: ['CONFIRMED', 'SENT'] }, // Only include completed deliveries
    },
    include: {
      items: {
        include: {
          item: {
            include: { category: true }
          }
        }
      }
    },
    orderBy: { date: 'desc' },
    take: 50, // Get more deliveries to capture all possible flavors
  });

  // Get all active items grouped by category for store stocktake
  const allCategories: CategoryWithItems[] = await prisma.category.findMany({
    include: {
      items: {
        where: { isActive: true },
        orderBy: { name: 'asc' }
      }
    },
    orderBy: { sortOrder: 'asc' }
  });

  // Extract ALL unique gelato flavors that have been delivered to this store
  const deliveredGelatoFlavors = new Map();
  deliveryPlans.forEach((plan: DeliveryPlanWithItems) => {
    plan.items.forEach((deliveryItem) => {
      const item = deliveryItem.item;
      if (item.category.name === 'Gelato Flavors' && item.isActive) {
        if (!deliveredGelatoFlavors.has(item.id)) {
          deliveredGelatoFlavors.set(item.id, {
            ...item,
            firstDelivered: plan.date, // Keep track of first delivery
            lastDelivered: plan.date, // And most recent delivery
            totalDelivered: deliveryItem.quantity,
            deliveryCount: 1
          });
        } else {
          // Update with more recent delivery info
          const existing = deliveredGelatoFlavors.get(item.id);
          existing.lastDelivered = new Date(Math.max(
            new Date(existing.lastDelivered).getTime(),
            new Date(plan.date).getTime()
          ));
          existing.totalDelivered += deliveryItem.quantity;
          existing.deliveryCount += 1;
        }
      }
    });
  });

  // Convert delivered gelato flavors to array
  const availableGelatoFlavors = Array.from(deliveredGelatoFlavors.values())
    .sort((a, b) => a.name.localeCompare(b.name));

  // Build categories for stocktake - include all categories except Ingredients (factory-specific)
  const stocktakeCategories = allCategories
    .filter((cat: CategoryWithItems) => cat.name !== 'Ingredients') // Exclude factory ingredients
    .map((category: CategoryWithItems) => {
      if (category.name === 'Gelato Flavors') {
        // For gelato flavors, only include those that have been delivered
        return {
          id: category.id,
          name: category.name,
          items: availableGelatoFlavors
        };
      } else {
        // For other categories, include all active items
        return {
          id: category.id,
          name: category.name,
          items: category.items
        };
      }
    })
    .filter((category) => category.items.length > 0); // Only include categories with items

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">{store.name} nightly stocktake</h1>
      <p className="text-sm text-gray-500 mb-6">Please count all items currently in your store, including gelato flavors, cleaning supplies, packaging, and other inventory.</p>

      {stocktakeCategories.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-yellow-800 mb-2">No Items Available</h3>
          <p className="text-yellow-700">
            No items have been set up for stocktaking yet. Please contact the factory if you believe this is incorrect.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Stocktake Categories ({stocktakeCategories.length})</h3>
            <p className="text-sm text-blue-700">
              Complete inventory count for {store.name} including all store items and delivered gelato flavors.
            </p>
            <div className="mt-2 space-y-1">
              {stocktakeCategories.map((category) => (
                <div key={category.id} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{category.name}</span>
                  <span className="text-sm text-blue-600">{category.items.length} items</span>
                </div>
              ))}
            </div>
          </div>
          <StocktakeForm storeSlug={store.slug} categories={stocktakeCategories} />
        </>
      )}
    </div>
  );
}

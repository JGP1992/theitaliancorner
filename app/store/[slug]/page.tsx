import '../../globals.css';
import { prisma } from '@/app/lib/prisma';
import StocktakeForm from './stocktake-form';

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

export default async function StorePage({ params }: any) {
  const { slug } = params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return <div>Store not found</div>;
  // Fetch gelato delivery items for this store efficiently (flat list), limited to a reasonable window
  const windowDays = 90; // look back ~3 months for delivered flavors (perf)
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const gelatoDeliveries = await prisma.deliveryItem.findMany({
    where: {
      plan: {
        storeId: store.id,
        status: { in: ['CONFIRMED', 'SENT'] },
        date: { gte: since },
      },
      item: {
        isActive: true,
        category: { name: 'Gelato Flavors' },
      },
    },
    select: {
      quantity: true,
      plan: { select: { date: true } },
      item: {
        select: {
          id: true,
          name: true,
          isActive: true,
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { plan: { date: 'desc' } },
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
  const deliveredGelatoFlavors = new Map<string, any>();
  for (const di of gelatoDeliveries) {
    const item = di.item;
    const planDate = di.plan?.date ? new Date(di.plan.date) : null;
    if (!item || item.category?.name !== 'Gelato Flavors') continue;
    if (!deliveredGelatoFlavors.has(item.id)) {
      deliveredGelatoFlavors.set(item.id, {
        id: item.id,
        name: item.name,
        isActive: item.isActive,
        category: item.category,
        firstDelivered: planDate,
        lastDelivered: planDate,
        totalDelivered: di.quantity || 0,
        deliveryCount: 1,
      });
    } else {
      const existing = deliveredGelatoFlavors.get(item.id);
      if (planDate) {
        existing.firstDelivered = existing.firstDelivered ? new Date(Math.min(existing.firstDelivered.getTime(), planDate.getTime())) : planDate;
        existing.lastDelivered = existing.lastDelivered ? new Date(Math.max(existing.lastDelivered.getTime(), planDate.getTime())) : planDate;
      }
      existing.totalDelivered += di.quantity || 0;
      existing.deliveryCount += 1;
    }
  }

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
      {/* Remember last visited store on the client */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try { localStorage.setItem('lastStoreSlug', ${JSON.stringify(slug)}); } catch {}`,
        }}
      />
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

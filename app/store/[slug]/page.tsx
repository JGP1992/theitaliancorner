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
  const { slug } = await params; // ensure awaited per Next.js dynamic route requirements
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return <div>Store not found</div>;
  // Load persisted preferences (JSON)
  const preferences = (store as any).preferences as { categoryVisibility?: Record<string, boolean> } | null;
  const visibleByCategoryId = preferences?.categoryVisibility || {};
  // Drive categories directly from store inventory configuration, merging store-specific targets
  const storeInventory = await prisma.storeInventory.findMany({
    where: { storeId: store.id, isActive: true },
    include: { item: { include: { category: true } } },
    orderBy: [
      { item: { category: { sortOrder: 'asc' } } },
      { item: { sortOrder: 'asc' } },
    ],
  });

  // Latest stocktake quantities to prefill defaults
  const latest = await prisma.stocktake.findFirst({
    where: { storeId: store.id },
    orderBy: { date: 'desc' },
    include: { items: true },
  });
  const latestMap = new Map<string, number | null>();
  if (latest) {
    for (const si of latest.items) latestMap.set(si.itemId, si.quantity ?? null);
  }

  // Group by category
  const byCategory: Record<string, { id: string; name: string; items: any[] }> = {};
  for (const si of storeInventory) {
    const cat = si.item.category;
    if (!byCategory[cat.id]) byCategory[cat.id] = { id: cat.id, name: cat.name, items: [] };
    byCategory[cat.id].items.push({
      id: si.item.id,
      name: si.item.name,
      targetNumber: si.targetQuantity ?? si.item.targetNumber ?? null,
      targetText: si.targetText ?? si.item.targetText ?? null,
      unit: si.unit ?? si.item.unit ?? null,
      // Prefill metadata (can be used by client if desired)
      lastQuantity: latestMap.get(si.itemId) ?? undefined,
    });
  }
  // Apply category visibility if configured; default to visible when not specified
  const stocktakeCategories = Object.values(byCategory)
    .filter((c) => c.items.length > 0)
    .filter((c) => {
      const flag = visibleByCategoryId[c.id];
      return flag === undefined ? true : !!flag;
    });

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

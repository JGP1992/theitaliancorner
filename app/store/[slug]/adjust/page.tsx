import '../../../globals.css';
import { prisma } from '@/app/lib/prisma';
import AdjustStockForm from './adjust-form';

interface CategoryWithItems {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    isActive: boolean;
    categoryId: string;
    unit: string | null;
    sortOrder: number;
  }>;
}

export default async function AdjustStockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return <div>Store not found</div>;

  // All active items by category, excluding factory-only Ingredients
  const categories: CategoryWithItems[] = await prisma.category.findMany({
    include: {
      items: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const filtered = categories
    .filter((c) => c.name !== 'Ingredients')
    .map((c) => ({ id: c.id, name: c.name, items: c.items.map((i) => ({ id: i.id, name: i.name, unit: i.unit })) }))
    .filter((c) => c.items.length > 0);

  return (
    <div>
      <script
        dangerouslySetInnerHTML={{
          __html: `try { localStorage.setItem('lastStoreSlug', ${JSON.stringify(slug)}); } catch {}`,
        }}
      />
      <h1 className="text-2xl font-semibold mb-1">{store.name} — Adjust stock</h1>
      <p className="text-sm text-gray-500 mb-6">Make quick add/remove adjustments. These are saved as a small stocktake entry for tracking.</p>
      <AdjustStockForm storeSlug={slug} categories={filtered as any} />
    </div>
  );
}

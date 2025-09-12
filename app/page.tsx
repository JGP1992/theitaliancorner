import Link from 'next/link';
import { prisma } from '@/app/lib/prisma';

type Store = {
  id: string;
  name: string;
  slug: string;
};

export default async function Home() {
  let stores = [];
  try {
    stores = await prisma.store.findMany({
      orderBy: { name: 'asc' }
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-red-600">Failed to load stores. Please check the database connection.</p>
          <p className="text-sm text-gray-500 mt-2">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Select a store</h1>
        <p className="text-gray-600">Choose a store to perform stocktake</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {stores.map((store: Store) => (
          <Link
            key={store.id}
            href={`/store/${store.slug}`}
            className="block p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200"
          >
            <div className="text-xl font-semibold text-gray-900 mb-1">{store.name}</div>
            <div className="text-sm text-gray-500">Enter stocktake</div>
          </Link>
        ))}
      </div>
      
      {stores.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No stores found</h3>
          <p className="text-gray-500">Please contact an administrator to set up stores.</p>
        </div>
      )}
    </div>
  );
}

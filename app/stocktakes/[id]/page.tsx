'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Package, FileText, Camera } from 'lucide-react';
import Link from 'next/link';

interface StocktakeItem {
  id: string;
  itemId: string;
  quantity: number | null;
  note: string | null;
  item: {
    id: string;
    name: string;
    category: {
      id: string;
      name: string;
      sortOrder: number;
    } | null;
  };
}

interface Stocktake {
  id: string;
  date: string;
  submittedAt: string;
  photoUrl: string | null;
  notes: string | null;
  store: {
    id: string;
    name: string;
    slug: string;
  };
  items: StocktakeItem[];
  itemCount: number;
  totalQuantity: number;
}

export default function StocktakeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [stocktake, setStocktake] = useState<Stocktake | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStocktake = useCallback(async () => {
    try {
      const response = await fetch(`/api/stocktakes/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setStocktake(data);
      } else if (response.status === 404) {
        setError('Stocktake not found');
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        setError('Failed to load stocktake');
      }
    } catch (error) {
      console.error('Failed to fetch stocktake:', error);
      setError('Failed to load stocktake');
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    if (params.id) {
      fetchStocktake();
    }
  }, [params.id, fetchStocktake]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !stocktake) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
            <p className="text-gray-600 mb-6">{error || 'Stocktake not found'}</p>
            <Link
              href="/stocktakes"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Stocktakes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Group items by category
  const itemsByCategory = stocktake.items.reduce((acc, stocktakeItem) => {
    const categoryName = stocktakeItem.item.category?.name || 'Uncategorized';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(stocktakeItem);
    return acc;
  }, {} as Record<string, StocktakeItem[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/stocktakes"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Stocktakes
          </Link>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{stocktake.store.name}</h1>
                <p className="text-gray-600 mt-1">{stocktake.store.slug}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center text-gray-600 mb-2">
                  <Calendar className="h-5 w-5 mr-2" />
                  {new Date(stocktake.date).toLocaleDateString()}
                </div>
                <div className="flex items-center text-gray-600">
                  <Package className="h-5 w-5 mr-2" />
                  {stocktake.itemCount} items ({stocktake.totalQuantity} total)
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center text-sm text-gray-600">
                <FileText className="h-4 w-4 mr-2" />
                Submitted: {new Date(stocktake.submittedAt).toLocaleString()}
              </div>
              {stocktake.photoUrl && (
                <div className="flex items-center text-sm text-gray-600">
                  <Camera className="h-4 w-4 mr-2" />
                  Photo available
                </div>
              )}
              {stocktake.notes && (
                <div className="text-sm text-gray-600">
                  <strong>Notes:</strong> {stocktake.notes}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items by Category */}
        <div className="space-y-6">
          {Object.entries(itemsByCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([categoryName, items]) => (
            <div key={categoryName} className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">{categoryName}</h2>
                <p className="text-sm text-gray-600">{items.length} items</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((stocktakeItem) => (
                      <tr key={stocktakeItem.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {stocktakeItem.item.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {stocktakeItem.quantity !== null ? stocktakeItem.quantity : 'Not counted'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {stocktakeItem.note || '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {stocktake.photoUrl && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Stocktake Photo</h2>
            <div className="flex justify-center">
              <img
                src={stocktake.photoUrl}
                alt="Stocktake photo"
                className="max-w-full h-auto rounded-lg shadow"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

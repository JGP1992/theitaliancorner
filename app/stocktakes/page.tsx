'use client';

import '../globals.css';
import { useState, useEffect } from 'react';
import { Calendar, Store, Package, Eye } from 'lucide-react';
import Link from 'next/link';

interface Stocktake {
  id: string;
  date: string;
  store: {
    id: string;
    name: string;
    slug: string;
  };
  submittedAt: string;
  submittedBy?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  itemCount: number;
  totalQuantity: number;
}

export default function StocktakesPage() {
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [after, setAfter] = useState<string>('');
  const [before, setBefore] = useState<string>('');

  useEffect(() => {
    fetchStocktakes();
  }, []);

  const fetchStocktakes = async (opts?: { after?: string; before?: string }) => {
    try {
      const params = new URLSearchParams();
      const a = opts?.after ?? after;
      const b = opts?.before ?? before;
      if (a) params.set('after', a);
      if (b) params.set('before', b);
      const response = await fetch(`/api/stocktakes${params.toString() ? `?${params.toString()}` : ''}`);
      if (response.ok) {
        const data = await response.json();
        setStocktakes(data.stocktakes);
      }
    } catch (error) {
      console.error('Failed to fetch stocktakes:', error);
    } finally {
      setLoading(false);
    }
  };

  function formatDate(d: Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getWeekRange(offsetWeeks = 0) {
    const today = new Date();
    // Monday as start of week
    const dow = (today.getDay() + 6) % 7; // 0=Mon .. 6=Sun
    const start = new Date(today);
    start.setDate(today.getDate() - dow + offsetWeeks * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: start, end: end };
  }

  const applyToday = async () => {
    const t = formatDate(new Date());
    setAfter(t);
    setBefore(t);
    setLoading(true);
    await fetchStocktakes({ after: t, before: t });
  };

  const applyThisWeek = async () => {
    const { start, end } = getWeekRange(0);
    const a = formatDate(start);
    const b = formatDate(end);
    setAfter(a);
    setBefore(b);
    setLoading(true);
    await fetchStocktakes({ after: a, before: b });
  };

  const applyLastWeek = async () => {
    const { start, end } = getWeekRange(-1);
    const a = formatDate(start);
    const b = formatDate(end);
    setAfter(a);
    setBefore(b);
    setLoading(true);
    await fetchStocktakes({ after: a, before: b });
  };

  const exportToExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (after) params.set('after', after);
      if (before) params.set('before', before);
      if (selectedStore !== 'all') {
        const selected = stores.find(s => s!.slug === selectedStore);
        if (selected?.id) params.set('storeId', selected.id);
      }
      const res = await fetch(`/api/stocktakes/export?${params.toString()}`, {
        method: 'GET',
      });
      if (!res.ok) {
        console.error('Export failed');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stocktakes_${after || 'start'}_${before || 'end'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export', e);
    }
  };

  const filteredStocktakes = stocktakes.filter(stocktake => {
    if (selectedStore === 'all') return true;
    return stocktake.store.slug === selectedStore;
  });

  const stores = Array.from(new Set(stocktakes.map(st => st.store.slug)))
    .map(slug => stocktakes.find(st => st.store.slug === slug)?.store)
    .filter(Boolean);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Stocktakes</h1>
          <p className="mt-2 text-gray-600">View and manage stocktake records across all stores</p>
        </div>

        {/* Filters + Export */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Stores</option>
              {stores.map(store => (
                <option key={store!.slug} value={store!.slug}>{store!.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">After</label>
            <input type="date" value={after} onChange={(e) => setAfter(e.target.value)} className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Before</label>
            <input type="date" value={before} onChange={(e) => setBefore(e.target.value)} className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setLoading(true); fetchStocktakes(); }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Apply
            </button>
            <button
              onClick={applyToday}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              title="Set dates to today and refresh"
            >
              Today
            </button>
            <button
              onClick={applyThisWeek}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              title="Set dates to Monday–Sunday this week and refresh"
            >
              This Week
            </button>
            <button
              onClick={applyLastWeek}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              title="Set dates to Monday–Sunday last week and refresh"
            >
              Last Week
            </button>
            <button
              onClick={exportToExcel}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-gray-50"
            >
              Export to Excel
            </button>
          </div>
        </div>

        {/* Stocktakes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStocktakes.map((stocktake) => (
            <div key={stocktake.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Store className="h-8 w-8 text-blue-600" />
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">{stocktake.store.name}</h3>
                    <p className="text-sm text-gray-500">{stocktake.store.slug}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  {new Date(stocktake.date).toLocaleDateString()}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Package className="h-4 w-4 mr-2" />
                  {stocktake.itemCount} items ({stocktake.totalQuantity} total)
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  Submitted: {new Date(stocktake.submittedAt).toLocaleDateString()}
                  {stocktake.submittedBy && (
                    <>
                      {' '}by {stocktake.submittedBy.firstName} {stocktake.submittedBy.lastName}
                    </>
                  )}
                </span>
                <Link
                  href={`/stocktakes/${stocktake.id}`}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filteredStocktakes.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No stocktakes found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {selectedStore === 'all' ? 'No stocktakes have been recorded yet.' : `No stocktakes found for the selected store.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

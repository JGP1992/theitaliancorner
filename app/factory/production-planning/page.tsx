'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type ProductionRequirement = {
  flavorName: string;
  totalTubs: number;
  deliveries: Array<{
    date: string;
    destination: string;
    quantity: number;
    status: string;
  }>;
};

type InventoryItem = {
  itemName: string;
  category: string;
  totalQuantity: number;
  lastUpdated: string;
  stocktakes: Array<{
    store: string;
    quantity: number;
    date: string;
  }>;
};

type ProductionData = {
  productionPlan: ProductionRequirement[];
  inventory: InventoryItem[];
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalFlavors: number;
    totalTubs: number;
    upcomingDeliveries: number;
  };
};

export default function ProductionPlanningPage() {
  const [data, setData] = useState<ProductionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [activeTab, setActiveTab] = useState<'production' | 'inventory'>('production');

  useEffect(() => {
    fetchProductionData();
  }, [days]);

  const fetchProductionData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/production-plan?days=${days}`);
      const productionData = await response.json();
      setData(productionData);
    } catch (error) {
      console.error('Failed to fetch production data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading production plan...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4 flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Failed to load production data
          </div>
          <button
            onClick={fetchProductionData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Production Planning</h1>
              <p className="mt-2 text-gray-600">
                Plan gelato production and manage ingredient inventory
              </p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/factory"
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                ← Back to Factory
              </Link>
              <Link
                href="/flavors"
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                Manage Flavors
              </Link>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-8 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Planning Period:</label>
              <select
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={3}>Next 3 days</option>
                <option value={7}>Next 7 days</option>
                <option value={14}>Next 2 weeks</option>
                <option value={30}>Next month</option>
              </select>
            </div>
            <div className="text-sm text-gray-600">
              {data.dateRange.start} to {data.dateRange.end}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Flavors to Produce</p>
                <p className="text-2xl font-bold text-gray-900">{data.summary.totalFlavors}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Tubs Needed</p>
                <p className="text-2xl font-bold text-gray-900">{data.summary.totalTubs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Upcoming Deliveries</p>
                <p className="text-2xl font-bold text-gray-900">{data.summary.upcomingDeliveries}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('production')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'production'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Production Plan
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'inventory'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Ingredient Inventory
              </button>
            </nav>
          </div>
        </div>

        {/* Production Plan Tab */}
        {activeTab === 'production' && (
          <div className="space-y-6">
            {data.productionPlan.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No production needed</h3>
                <p className="text-gray-600 mb-6">
                  No gelato deliveries scheduled for the selected period.
                </p>
              </div>
            ) : (
              data.productionPlan.map((requirement) => (
                <div key={requirement.flavorName} className="bg-white rounded-lg shadow-sm border">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {requirement.flavorName}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {requirement.totalTubs} tub{requirement.totalTubs !== 1 ? 's' : ''} needed
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-600">
                          {requirement.totalTubs}
                        </div>
                        <div className="text-sm text-gray-500">tubs</div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Delivery Schedule:</h4>
                    <div className="space-y-2">
                      {requirement.deliveries.map((delivery, index) => (
                        <div key={index} className="flex items-center justify-between text-sm bg-gray-50 rounded p-3">
                          <div className="flex items-center space-x-3">
                            <div className={`w-2 h-2 rounded-full ${
                              delivery.status === 'CONFIRMED' ? 'bg-blue-400' : 'bg-yellow-400'
                            }`}></div>
                            <span className="font-medium text-gray-900">{delivery.destination}</span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-600">{delivery.date}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{delivery.quantity} tub{delivery.quantity !== 1 ? 's' : ''}</span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              delivery.status === 'CONFIRMED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {delivery.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Ingredient Inventory</h3>
              <p className="text-sm text-gray-600 mt-1">
                Current stock levels across all stores
              </p>
            </div>

            {data.inventory.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <p>No inventory data available</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {data.inventory.map((item) => (
                  <div key={item.itemName} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">{item.itemName}</h4>
                            <p className="text-xs text-gray-500">{item.category}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900">
                            {item.totalQuantity.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500">total units</div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            Updated {new Date(item.lastUpdated).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.stocktakes.length} store{item.stocktakes.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stocktake details */}
                    <div className="mt-3 ml-11">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {item.stocktakes.slice(0, 6).map((stocktake, index) => (
                          <div key={index} className="text-xs bg-gray-50 rounded px-2 py-1">
                            <span className="font-medium text-gray-700">{stocktake.store}:</span>
                            <span className="ml-1 text-gray-600">{stocktake.quantity.toFixed(1)} ({stocktake.date})</span>
                          </div>
                        ))}
                        {item.stocktakes.length > 6 && (
                          <div className="text-xs text-gray-500 px-2 py-1">
                            +{item.stocktakes.length - 6} more stores
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

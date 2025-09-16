'use client';

import '../globals.css';

// Set recovery link 
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import QuickDelivery from './quick-delivery';
import EditDeliveryPlan from './edit-delivery-plan';

type TabKey = 'overview' | 'deliveries' | 'quick';

type LatestStocktake = {
  id: string;
  submittedAt: Date;
  photoUrl: string | null;
  store: { name: string; slug: string };
  submittedBy?: { id: string; email: string; firstName: string; lastName: string } | null;
  items: { quantity: number | null; item: { name: string; category: { name: string } } }[];
};

type DeliveryPlan = {
  id: string;
  date: string;
  status: 'DRAFT' | 'CONFIRMED' | 'SENT';
  notes?: string;
  store?: { id: string; name: string; slug: string };
  customers: { customer: { id: string; name: string; type: string } }[];
  items: {
    id: string;
    quantity: number;
    note?: string;
    item: {
      id: string;
      name: string;
      unit?: string;
      category: { name: string };
    };
  }[];
};

type FactoryData = {
  latestStocktakes: LatestStocktake[];
  deliveryPlans: DeliveryPlan[];
  customers: { id: string; name: string; type: string }[];
  stores: { id: string; name: string; slug: string }[];
  totalStocktakes: number;
  activeStores: number;
  totalCustomers: number;
  pendingDeliveries: number;
  todaysDeliveries: DeliveryPlan[];
  weeklyStats: {
    stocktakesThisWeek: number;
    deliveriesThisWeek: number;
    avgItemsPerStocktake: number;
  };
  topItems: { name: string; totalQuantity: number; category: string }[];
  deliveryStatusBreakdown: { status: string; count: number; percentage: number }[];
  lowStockItems: { name: string; totalQuantity: number; category: string; lastUpdated: string }[];
};

async function getFactoryData(): Promise<FactoryData> {
  try {
    const [latestStocktakesRes, deliveryPlansRes, customersRes, storesRes, productionPlanRes] = await Promise.all([
      fetch('/api/latest-stocktakes', { credentials: 'include', cache: 'no-store' }),
      fetch('/api/delivery-plans', { credentials: 'include', cache: 'no-store' }),
      fetch('/api/customers', { credentials: 'include', cache: 'no-store' }),
      fetch('/api/stores', { credentials: 'include', cache: 'no-store' }),
      fetch('/api/production-plan?days=7', { credentials: 'include', cache: 'no-store' })
    ]);

    // Check if all responses are ok
    if (!latestStocktakesRes.ok || !deliveryPlansRes.ok || !customersRes.ok || !storesRes.ok || !productionPlanRes.ok) {
      throw new Error(`API failures: latestStocktakes=${latestStocktakesRes.status}, deliveryPlans=${deliveryPlansRes.status}, customers=${customersRes.status}, stores=${storesRes.status}, productionPlan=${productionPlanRes.status}`);
    }

    const [latestStocktakes, deliveryPlans, customersRaw, storesRaw, productionPlanData] = await Promise.all([
      latestStocktakesRes.json().catch(err => { console.error('latestStocktakes JSON parse error:', err); throw err; }),
      deliveryPlansRes.json().catch(err => { console.error('deliveryPlans JSON parse error:', err); throw err; }),
      customersRes.json().catch(err => { console.error('customers JSON parse error:', err); throw err; }),
      storesRes.json().catch(err => { console.error('stores JSON parse error:', err); throw err; }),
      productionPlanRes.json().catch(err => { console.error('productionPlan JSON parse error:', err); throw err; })
    ]);

    // Unwrap API shapes to arrays
    const customers = Array.isArray(customersRaw) ? customersRaw : (customersRaw?.customers ?? []);
    const stores = Array.isArray(storesRaw) ? storesRaw : (storesRaw?.stores ?? []);

  const totalStocktakesRes = await fetch('/api/stocktakes/count', { credentials: 'include' });
    if (!totalStocktakesRes.ok) {
      throw new Error(`Stocktakes count API failed: ${totalStocktakesRes.status}`);
    }
    const totalStocktakesData = await totalStocktakesRes.json().catch(err => { console.error('stocktakes count JSON parse error:', err); throw err; });
    const totalStocktakes = totalStocktakesData.count || 0;

  const activeStores = stores.length;
  const totalCustomers = customers.length;
    const pendingDeliveries = deliveryPlans.filter((plan: DeliveryPlan) => plan.status === 'DRAFT').length;

    // Today's deliveries (use local date logic to avoid UTC drift)
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayLocal = `${now.getFullYear()}-${mm}-${dd}`;
    const todaysDeliveries = deliveryPlans.filter((plan: DeliveryPlan) => {
      const d = new Date(plan.date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}` === todayLocal;
    });

    // Weekly stats
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const stocktakesThisWeekRes = await fetch(`/api/stocktakes?after=${weekAgo.toISOString()}`, { credentials: 'include' });
    let stocktakesThisWeek = 0;
    if (stocktakesThisWeekRes.ok) {
      try {
        const stocktakesData = await stocktakesThisWeekRes.json().catch(err => {
          console.error('stocktakes weekly JSON parse error:', err);
          throw err;
        });
        if (Array.isArray(stocktakesData)) {
          stocktakesThisWeek = stocktakesData.length;
        } else if (Array.isArray(stocktakesData?.stocktakes)) {
          stocktakesThisWeek = stocktakesData.stocktakes.length;
        } else if (typeof stocktakesData?.count === 'number') {
          stocktakesThisWeek = stocktakesData.count;
        } else {
          stocktakesThisWeek = 0;
        }
      } catch (error) {
        console.warn('Failed to parse stocktakes data:', error);
        stocktakesThisWeek = 0;
      }
    } else {
      console.warn('Stocktakes weekly API failed:', stocktakesThisWeekRes.status);
    }

    const deliveriesThisWeek = deliveryPlans.filter((plan: DeliveryPlan) =>
      new Date(plan.date) >= weekAgo
    ).length;

    const avgItemsPerStocktake = latestStocktakes.length > 0
      ? Math.round(latestStocktakes.reduce((sum: number, st: LatestStocktake) => sum + st.items.length, 0) / latestStocktakes.length)
      : 0;

    // Top items analysis
    const itemCounts: Record<string, { name: string; totalQuantity: number; category: string }> = {};
    latestStocktakes.forEach((stocktake: LatestStocktake) => {
      stocktake.items.forEach((item: { quantity: number | null; item: { name: string; category: { name: string } } }) => {
        if (item.quantity && item.quantity > 0) {
          const key = item.item.name;
          if (!itemCounts[key]) {
            itemCounts[key] = {
              name: item.item.name,
              totalQuantity: 0,
              category: item.item.category?.name || 'Unknown'
            };
          }
          itemCounts[key].totalQuantity += item.quantity;
        }
      });
    });

    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5);

    // Delivery status breakdown
    const statusCounts = deliveryPlans.reduce((acc: Record<string, number>, plan: DeliveryPlan) => {
      acc[plan.status] = (acc[plan.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const deliveryStatusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count: count as number,
      percentage: deliveryPlans.length > 0 ? Math.round((count as number / deliveryPlans.length) * 100) : 0
    }));

    // Calculate low stock items using per-item threshold (targetThreshold) or default 5
    const lowStockItems = productionPlanData.inventory
      .filter((item: { totalQuantity: number; targetThreshold?: number }) => item.totalQuantity < (item.targetThreshold ?? 5))
      .sort((a: { totalQuantity: number; targetThreshold?: number }, b: { totalQuantity: number; targetThreshold?: number }) => a.totalQuantity - b.totalQuantity)
      .slice(0, 10); // Show top 10 low stock items

    return {
      latestStocktakes,
      deliveryPlans,
  customers,
  stores,
      totalStocktakes,
      activeStores,
      totalCustomers,
      pendingDeliveries,
      todaysDeliveries,
      weeklyStats: {
        stocktakesThisWeek,
        deliveriesThisWeek,
        avgItemsPerStocktake
      },
      topItems,
      deliveryStatusBreakdown,
      lowStockItems
    };
  } catch (error) {
    console.error('Error in getFactoryData:', error);
    // Return default/empty data structure to prevent crashes
    return {
      latestStocktakes: [],
      deliveryPlans: [],
      customers: [],
      stores: [],
      totalStocktakes: 0,
      activeStores: 0,
      totalCustomers: 0,
      pendingDeliveries: 0,
      todaysDeliveries: [],
      weeklyStats: {
        stocktakesThisWeek: 0,
        deliveriesThisWeek: 0,
        avgItemsPerStocktake: 0
      },
      topItems: [],
      deliveryStatusBreakdown: [],
      lowStockItems: []
    };
  }
}

export default function FactoryPage() {
  const { hasRole } = useAuth();
  const [data, setData] = useState<FactoryData | null>(null);
  const [editingPlan, setEditingPlan] = useState<DeliveryPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getFactoryData()
      .then(setData)
      .catch((error) => {
        console.error('Failed to load factory data:', error);
        // Set empty data to prevent crashes
        setData({
          latestStocktakes: [],
          deliveryPlans: [],
          customers: [],
          stores: [],
          totalStocktakes: 0,
          activeStores: 0,
          totalCustomers: 0,
          pendingDeliveries: 0,
          todaysDeliveries: [],
          weeklyStats: {
            stocktakesThisWeek: 0,
            deliveriesThisWeek: 0,
            avgItemsPerStocktake: 0
          },
          topItems: [],
          deliveryStatusBreakdown: [],
          lowStockItems: []
        });
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Initialize and persist selected tab (supports URL hashes like #deliveries)
  useEffect(() => {
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
      const saved = typeof window !== 'undefined' ? localStorage.getItem('factoryActiveTab') : null;
      const initial = (hash || saved) as TabKey | null;
      if (initial && ['overview', 'deliveries', 'quick'].includes(initial)) {
        setActiveTab(initial as TabKey);
      }
    } catch {
      // no-op
    }
  }, []);

  const selectTab = (tab: TabKey) => {
    setActiveTab(tab);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('factoryActiveTab', tab);
        window.history.replaceState(null, '', `#${tab}`);
      }
    } catch {
      // no-op
    }
  };

  // Close the "More" menu on outside click or Escape
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!isMoreOpen) return;
      const target = e.target as Node | null;
      if (moreMenuRef.current && target && !moreMenuRef.current.contains(target)) {
        setIsMoreOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsMoreOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isMoreOpen]);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const newData = await getFactoryData();
      setData(newData);
    } catch (error) {
      console.error('Failed to refresh data:', error);
      // Don't update data on error, keep existing data
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditPlan = (plan: DeliveryPlan) => {
    setEditingPlan(plan);
  };

  const handleSavePlan = (updatedPlan: DeliveryPlan) => {
    if (data) {
      setData({
        ...data,
        deliveryPlans: data.deliveryPlans.map(plan =>
          plan.id === updatedPlan.id ? updatedPlan : plan
        )
      });
    }
    setEditingPlan(null);
  };

  const handleDeletePlan = async (planId: string) => {
    const plan = data?.deliveryPlans.find(p => p.id === planId);
    if (!plan) return;

    const destination = plan.store?.name || plan.customers.map((pc: { customer: { name: string } }) => pc.customer.name).join(', ') || 'Unknown';
    const confirmMessage = `Are you sure you want to delete the delivery plan for "${destination}" on ${new Date(plan.date).toLocaleDateString()}? This will also delete all associated delivery items.`;

    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/delivery/${planId}`, {
        method: 'DELETE',
      });

      if (response.ok && data) {
        setData({
          ...data,
          deliveryPlans: data.deliveryPlans.filter(plan => plan.id !== planId),
          pendingDeliveries: data.pendingDeliveries - (data.deliveryPlans.find(p => p.id === planId)?.status === 'DRAFT' ? 1 : 0)
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to delete delivery plan: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Failed to delete delivery plan. Please try again.');
    }
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading factory dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Factory Dashboard</h1>
                <p className="mt-2 text-gray-600">Monitor stocktakes, manage deliveries, and track inventory</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href="/factory/production"
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  Today’s Production
                </Link>
                <Link
                  href="/factory/intake"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Factory Intake
                </Link>
                <Link
                  href="/admin/production-schedule"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Schedule Production
                </Link>
                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isMoreOpen}
                    onClick={() => setIsMoreOpen(v => !v)}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-1"
                  >
                    More
                    <svg className={`w-4 h-4 transition-transform ${isMoreOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.188l3.71-3.957a.75.75 0 111.08 1.04l-4.24 4.52a.75.75 0 01-1.08 0l-4.24-4.52a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {isMoreOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1"
                    >
                      {/* Master Stocktake link moved to Advanced section */}
                      <Link href={`/daily-deliveries?date=${new Date().toISOString().slice(0, 10)}`} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" role="menuitem">
                        Daily Deliveries
                      </Link>
                      <Link href="/staff-deliveries" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" role="menuitem">
                        Staff View
                      </Link>
                      <Link href="/recipes" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" role="menuitem">
                        👨‍🍳 Recipe Builder
                      </Link>
                      <Link href="/stock-ordering" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" role="menuitem">
                        Stock Ordering
                      </Link>
                      <Link href="/orders" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" role="menuitem">
                        Orders & Receipts
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-8">
            <div role="tablist" aria-label="Factory sections" className="flex overflow-x-auto no-scrollbar gap-2 border-b border-gray-200">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'deliveries', label: 'Deliveries' },
                { key: 'quick', label: 'Quick Create' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={activeTab === (key as TabKey)}
                  onClick={() => selectTab(key as TabKey)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    activeTab === (key as TabKey)
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border-l-4 border-blue-500">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-sm sm:text-sm font-medium text-gray-600">Total Stocktakes</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{data.totalStocktakes}</p>
                  <p className="text-xs text-gray-500">+{data.weeklyStats.stocktakesThisWeek} this week</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border-l-4 border-green-500">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-4 sm:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-sm sm:text-sm font-medium text-gray-600">Active Stores</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{data.activeStores}</p>
                  <p className="text-xs text-gray-500">All operational</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border-l-4 border-orange-500">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-8 sm:h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-4 sm:h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-sm sm:text-sm font-medium text-gray-600">Active Customers</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{data.totalCustomers}</p>
                  <p className="text-xs text-gray-500">Across all types</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border-l-4 border-yellow-500">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-8 sm:h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-4 sm:h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-sm sm:text-sm font-medium text-gray-600">Pending Deliveries</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{data.pendingDeliveries}</p>
                  <p className="text-xs text-gray-500">{data.todaysDeliveries.length} today</p>
                </div>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'overview' && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Production Planning</h2>
              <Link
                href="/factory/production-planning"
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                View Full Plan →
              </Link>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              {/* Today's Production Needs */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Today&apos;s Production Needs
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const todaysProduction = data.deliveryPlans
                      .filter(plan => plan.date.startsWith(new Date().toISOString().slice(0, 10)))
                      .flatMap(plan => plan.items)
                      .filter(item => item.item.category?.name === 'Gelato Flavors')
                      .reduce((acc: Record<string, number>, item) => {
                        acc[item.item.name] = (acc[item.item.name] || 0) + item.quantity;
                        return acc;
                      }, {} as Record<string, number>);

                    const entries = Object.entries(todaysProduction).slice(0, 5);

                    return entries.length > 0 ? entries.map(([flavor, quantity], index) => (
                      <div key={`flavor-${flavor}-${index}`} className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span className="text-gray-700 font-medium">{flavor}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-purple-600 bg-purple-100 px-2 py-1 rounded text-sm">
                            {quantity} tub{quantity !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8">
                        <div className="text-green-600 text-3xl mb-3">
                          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <p className="text-gray-700 font-medium mb-1">No gelato production needed today</p>
                        <p className="text-sm text-gray-500">All deliveries are up to date</p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Low Stock Alerts */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-6 border border-red-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Low Stock Alerts
                </h3>
                <div className="space-y-3">
                  {data.lowStockItems.length > 0 ? (
                    data.lowStockItems.slice(0, 5).map((item, index) => (
                      <div key={`low-stock-${item.name}-${index}`} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-red-600">!</span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                            <p className="text-xs text-gray-500">{item.category}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-red-600">{item.totalQuantity}</span>
                          <p className="text-xs text-gray-500">in stock</p>
                          {typeof (item as any).targetThreshold === 'number' && (
                            <p className="text-[10px] text-gray-500">min: {(item as any).targetThreshold}</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-green-600 text-2xl mb-2">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600">All items are well stocked!</p>
                      <p className="text-xs text-gray-500 mt-1">No items below minimum threshold</p>
                    </div>
                  )}
                  {data.lowStockItems.length > 5 && (
                    <p className="text-xs text-gray-500 text-center">
                      +{data.lowStockItems.length - 5} more low stock items
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'overview' && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Ingredient Inventory</h2>
              <Link
                href="/ingredients"
                className="text-sm text-green-600 hover:text-green-800 font-medium"
              >
                Manage Ingredients →
              </Link>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              {/* Ingredient Stock Levels */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Current Stock Levels
                </h3>
                <div className="space-y-3">
                  <div className="text-center py-6">
                    <p className="text-gray-700 font-medium">Ingredient tracking is coming soon</p>
                    <p className="text-sm text-gray-500">This section will display live ingredient inventory once connected</p>
                  </div>
                </div>
              </div>

              {/* Production Requirements */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Weekly Production Needs
                </h3>
                <div className="space-y-3">
                  {(() => {
                    // Calculate ingredient needs based on delivery plans
                    const weeklyNeeds = data.deliveryPlans
                      .filter(plan => {
                        const planDate = new Date(plan.date);
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return planDate >= weekAgo;
                      })
                      .flatMap(plan => plan.items)
                      .filter(item => item.item.category?.name === 'Gelato Flavors')
                      .reduce((acc: Record<string, number>, item) => {
                        // Estimate ingredient usage per flavor (simplified)
                        const baseIngredients = {
                          'Whole Milk': item.quantity * 2, // 2L per tub
                          'Sugar': item.quantity * 0.5, // 0.5kg per tub
                          'Heavy Cream': item.quantity * 0.3, // 0.3L per tub
                        };
                        
                        Object.entries(baseIngredients).forEach(([ingredient, amount]) => {
                          acc[ingredient] = (acc[ingredient] || 0) + amount;
                        });
                        
                        return acc;
                      }, {} as Record<string, number>);

                    const entries = Object.entries(weeklyNeeds).slice(0, 5);

                    return entries.length > 0 ? entries.map(([ingredient, amount], index) => (
                      <div key={`weekly-need-${ingredient}-${index}`} className="flex justify-between items-center">
                        <span className="text-gray-700">{ingredient}</span>
                        <span className="font-semibold text-blue-600">{amount.toFixed(1)} units</span>
                      </div>
                    )) : (
                      <p className="text-gray-600 text-center py-4">No production scheduled this week</p>
                    );
                  })()}
                  <p className="text-xs text-gray-500 text-right">Estimates based on tubs per simplified recipe</p>
                </div>
              </div>
            </div>
            </div>
            )}

            {activeTab === 'overview' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 mb-8">
            {/* Weekly Stats */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Weekly Overview
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Stocktakes</span>
                  <span className="font-semibold text-gray-900">{data.weeklyStats.stocktakesThisWeek}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Deliveries</span>
                  <span className="font-semibold text-gray-900">{data.weeklyStats.deliveriesThisWeek}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Items/Stocktake</span>
                  <span className="font-semibold text-gray-900">{data.weeklyStats.avgItemsPerStocktake}</span>
                </div>
              </div>
            </div>

            {/* Top Items */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Top Items This Week
              </h3>
              <div className="space-y-3">
                {data.topItems.slice(0, 5).map((item, index) => (
                  <div key={`top-item-${item.name}-${index}`} className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        #{index + 1}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                        <p className="text-xs text-gray-500">{item.category}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{item.totalQuantity}</span>
                  </div>
                ))}
                {data.topItems.length === 0 && (
                  <p className="text-sm text-gray-500">No items data available</p>
                )}
              </div>
            </div>

            {/* Delivery Status */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Delivery Status
              </h3>
              <div className="space-y-3">
                {data.deliveryStatusBreakdown.map((status) => (
                  <div key={status.status} className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        status.status === 'DRAFT' ? 'bg-yellow-400' :
                        status.status === 'CONFIRMED' ? 'bg-blue-400' :
                        'bg-green-400'
                      }`}></div>
                      <span className="text-sm text-gray-600 capitalize">{status.status.toLowerCase()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">{status.count}</span>
                      <span className="text-xs text-gray-500 ml-1">({status.percentage}%)</span>
                    </div>
                  </div>
                ))}
                {data.deliveryStatusBreakdown.length === 0 && (
                  <p className="text-sm text-gray-500">No deliveries yet</p>
                )}
              </div>
            </div>
          </div>
          )}

          {activeTab === 'overview' && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Recent Stocktakes</h2>
              <a href="/admin" className="text-sm text-blue-600 hover:text-blue-800">View all →</a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {data.latestStocktakes.map((stocktake: LatestStocktake) => (
                <div key={stocktake.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{stocktake.store.name}</h3>
                            <p className="text-sm text-gray-500">
                              {new Date(stocktake.submittedAt).toLocaleDateString()}
                              {stocktake.submittedBy && (
                                <>
                                  {' '}• by {stocktake.submittedBy.firstName} {stocktake.submittedBy.lastName}
                                </>
                              )}
                            </p>
                        </div>
                      </div>
                      {stocktake.photoUrl && (
                        <a href={stocktake.photoUrl} target="_blank" className="text-blue-600 hover:text-blue-800">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </a>
                      )}
                    </div>

                    <div className="space-y-2">
                      {stocktake.items
                        .filter((item: { quantity: number | null; item: { name: string } }) => item.quantity != null)
                        .slice(0, 5)
                        .map((item: { quantity: number | null; item: { name: string } }, index: number) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{item.item.name}</span>
                            <span className="font-medium text-gray-900">{item.quantity}</span>
                          </div>
                        ))}
                      {stocktake.items.filter((item: { quantity: number | null; item: { name: string } }) => item.quantity != null).length > 5 && (
                        <p className="text-xs text-gray-500">
                          +{stocktake.items.filter((item: { quantity: number | null; item: { name: string } }) => item.quantity != null).length - 5} more items
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {activeTab === 'deliveries' && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Delivery Plans</h2>
              <div className="flex space-x-2">
                <button
                  onClick={refreshData}
                  disabled={isLoading}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium min-w-[100px]"
                  title="Refresh data"
                >
                  Refresh
                </button>
                <Link
                  href={`/daily-deliveries?date=${new Date().toISOString().slice(0, 10)}`}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium min-w-[120px] text-center"
                >
                  View Daily
                </Link>
              </div>
            </div>

            {/* Gelato Flavor Delivery Summary */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 mb-6 border border-purple-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Today&apos;s Gelato Deliveries
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {data.deliveryPlans
                  .filter((plan: DeliveryPlan) => plan.status !== 'SENT')
                  .slice(0, 6)
                  .map((plan: DeliveryPlan) => {
                    const gelatoItems = plan.items.filter((item) =>
                      item.item.category?.name === 'Gelato Flavors'
                    );
                    if (gelatoItems.length === 0) return null;

                    return (
                      <div key={plan.id} className="bg-white rounded-lg p-4 shadow-sm border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">
                            {plan.store?.name || plan.customers.map((pc: { customer: { name: string } }) => pc.customer.name).join(', ')}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            plan.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {plan.status}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {gelatoItems.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-600">{item.item.name}</span>
                              <span className="font-medium">{item.quantity} tub{item.quantity !== 1 ? 's' : ''}</span>
                            </div>
                          ))}
                          {gelatoItems.length > 3 && (
                            <p className="text-xs text-gray-500">+{gelatoItems.length - 3} more flavors</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>



            {/* Today's Deliveries */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Today&apos;s Deliveries ({data.todaysDeliveries.length})
              </h3>
              {data.todaysDeliveries.length === 0 ? (
                <p className="text-gray-600">No deliveries scheduled for today</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  {data.todaysDeliveries.map((plan: DeliveryPlan) => (
                    <div key={plan.id} className="bg-white rounded-lg p-4 shadow-sm border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">
                          {plan.store?.name || plan.customers.map((pc: { customer: { name: string } }) => pc.customer.name).join(', ')}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          plan.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                          plan.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {plan.status}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total Items:</span>
                          <span className="font-medium">{plan.items.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Gelato Flavors:</span>
                          <span className="font-medium text-purple-600">
                            {plan.items.filter(item => item.item.category?.name === 'Gelato Flavors').length}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">All Delivery Plans</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {data.deliveryPlans.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    No delivery plans yet. Create your first delivery plan below.
                  </div>
                ) : (
                  data.deliveryPlans.map((plan: DeliveryPlan) => (
                    <div key={plan.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-3 h-3 rounded-full ${
                            plan.status === 'DRAFT' ? 'bg-yellow-400' :
                            plan.status === 'CONFIRMED' ? 'bg-blue-400' :
                            'bg-green-400'
                          }`}></div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {plan.store && plan.customers.length > 0
                                ? `${plan.store.name} + ${plan.customers.length} Customer${plan.customers.length > 1 ? 's' : ''}`
                                : plan.customers.length > 0
                                ? `${plan.customers.length} Customer${plan.customers.length > 1 ? 's' : ''}`
                                : (plan.store?.name || 'No Destination')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            plan.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                            plan.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {plan.status}
                          </span>
                          <span className="text-sm text-gray-500">{plan.items.length} items</span>
                          <span className="text-sm text-purple-600 font-medium">
                            {plan.items.filter(item => item.item.category?.name === 'Gelato Flavors').length} flavors
                          </span>
                          <div className="flex space-x-3">
                            <button
                              onClick={() => handleEditPlan(plan)}
                              className="px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors text-sm font-medium min-w-[60px]"
                              title="Edit plan"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePlan(plan.id)}
                              className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors text-sm font-medium min-w-[70px]"
                              title="Delete plan"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                      {(plan.store || plan.customers.length > 0) && (
                        <div className="mt-2 text-xs text-gray-600">
                          {plan.store && <span>Store: {plan.store.name}</span>}
                          {plan.store && plan.customers.length > 0 && <span> • </span>}
                          {plan.customers.length > 0 && (
                            <span>Customers: {plan.customers.map((pc: { customer: { name: string } }) => pc.customer.name).join(', ')}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          )}

          {activeTab === 'quick' && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Create Quick Delivery Plan</h2>
            <p className="text-gray-600 mb-6">This tool has moved to the Set Deliveries page.</p>
            <Link href="/deliveries/set" className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Go to Set Deliveries →</Link>
          </div>
          )}

          {/* Advanced section (System Admin only) */}
          {activeTab === 'overview' && hasRole?.('system_admin') && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Advanced</h2>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Factory Master Stocktake</p>
                    <p className="text-sm text-gray-600">Set or reset the factory baseline after a full physical count.</p>
                  </div>
                  <Link href="/factory/master-stocktake" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium">
                    Open
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingPlan && (
        <EditDeliveryPlan
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSave={handleSavePlan}
        />
      )}
    </>
  );
}

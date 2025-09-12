import { prisma } from '@/app/lib/prisma';
import Link from 'next/link';

type DeliveryItem = {
  quantity: number;
  note?: string | null;
  item: {
    name: string;
    unit?: string | null;
    category: { name: string };
  };
};

type DeliveryPlan = {
  id: string;
  date: Date;
  status: string;
  notes?: string | null;
  store?: { name: string; slug: string } | null;
  customers: { customer: { name: string; type: string } }[];
  items: DeliveryItem[];
};

type DailyDeliveriesProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function DailyDeliveriesPage({ searchParams }: DailyDeliveriesProps) {
  const params = await searchParams;
  const selectedDate = params.date ? new Date(params.date) : new Date();

  // Get deliveries for the selected date
  const deliveries = await prisma.deliveryPlan.findMany({
    where: {
      date: {
        gte: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()),
        lt: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1),
      },
    },
    include: {
      store: true,
      customers: {
        include: { customer: true },
      },
      items: {
        include: {
          item: {
            include: { category: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group deliveries by destination type
  const storeDeliveries = deliveries.filter((d: DeliveryPlan) => d.store);
  const customerDeliveries = deliveries.filter((d: DeliveryPlan) => d.customers.length > 0);

  // Calculate totals
  const totalDeliveries = deliveries.length;
  const confirmedDeliveries = deliveries.filter((d: DeliveryPlan) => d.status === 'CONFIRMED').length;
  const sentDeliveries = deliveries.filter((d: DeliveryPlan) => d.status === 'SENT').length;
  const draftDeliveries = deliveries.filter((d: DeliveryPlan) => d.status === 'DRAFT').length;

  // Calculate item totals by category
  const itemTotals = deliveries.flatMap((d: DeliveryPlan) => d.items).reduce((acc: Record<string, { total: number; items: Record<string, number> }>, item: DeliveryItem) => {
    const category = item.item.category?.name || 'No Category';
    if (!acc[category]) {
      acc[category] = { total: 0, items: {} };
    }
    acc[category].total += item.quantity;

    const itemName = item.item.name;
    if (!acc[category].items[itemName]) {
      acc[category].items[itemName] = 0;
    }
    acc[category].items[itemName] += item.quantity;

    return acc;
  }, {} as Record<string, { total: number; items: Record<string, number> }>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Daily Deliveries</h1>
              <p className="mt-2 text-gray-600">
                Overview of all deliveries for {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/factory"
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Back to Factory
              </Link>
              <Link
                href="/staff-deliveries"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Simple Staff View
              </Link>
            </div>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <Link
              href={`/daily-deliveries?date=${new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`}
              className="px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
            >
              ← Previous Day
            </Link>
            <div className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium">
              {selectedDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            <Link
              href={`/daily-deliveries?date=${new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`}
              className="px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
            >
              Next Day →
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                <p className="text-sm font-medium text-gray-600">Total Deliveries</p>
                <p className="text-2xl font-bold text-gray-900">{totalDeliveries}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Confirmed</p>
                <p className="text-2xl font-bold text-gray-900">{confirmedDeliveries}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Sent</p>
                <p className="text-2xl font-bold text-gray-900">{sentDeliveries}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Draft</p>
                <p className="text-2xl font-bold text-gray-900">{draftDeliveries}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Item Summary by Category */}
        {Object.keys(itemTotals).length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Item Summary by Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(itemTotals).map(([category, data]) => {
                const categoryData = data as { total: number; items: Record<string, number> };
                return (
                <div key={category} className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{category}</h3>
                  <div className="space-y-2">
                    {Object.entries(categoryData.items)
                      .sort(([,a], [,b]) => (b as number) - (a as number))
                      .slice(0, 5)
                      .map(([itemName, quantity]) => (
                        <div key={itemName} className="flex justify-between text-sm">
                          <span className="text-gray-600">{itemName}</span>
                          <span className="font-medium text-gray-900">{quantity as number}</span>
                        </div>
                      ))}
                    {Object.keys(categoryData.items).length > 5 && (
                      <p className="text-xs text-gray-500 pt-2 border-t">
                        +{Object.keys(categoryData.items).length - 5} more items
                      </p>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-gray-900">Total {category}:</span>
                      <span className="text-blue-600">{categoryData.total}</span>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}

        {/* Store Deliveries */}
        {storeDeliveries.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Store Deliveries</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {storeDeliveries.map((delivery: DeliveryPlan) => (
                <div key={delivery.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          delivery.status === 'DRAFT' ? 'bg-yellow-400' :
                          delivery.status === 'CONFIRMED' ? 'bg-blue-400' :
                          'bg-green-400'
                        }`}></div>
                        <h3 className="text-lg font-semibold text-gray-900">{delivery.store?.name}</h3>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        delivery.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                        delivery.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {delivery.status}
                      </span>
                    </div>

                    {delivery.notes && (
                      <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded">
                        {delivery.notes}
                      </p>
                    )}

                    <div className="space-y-2">
                      {delivery.items.map((item: DeliveryItem, index: number) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex-1">
                            <span className="text-gray-900 font-medium">{item.item.name}</span>
                            <span className="text-gray-500 ml-2">({item.item.category?.name || 'No Category'})</span>
                            {item.note && (
                              <p className="text-xs text-gray-600 mt-1">{item.note}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-gray-900">{item.quantity}</span>
                            {item.item.unit && (
                              <span className="text-xs text-gray-500 ml-1">{item.item.unit}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer Deliveries */}
        {customerDeliveries.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Customer Deliveries</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {customerDeliveries.map((delivery: DeliveryPlan) => (
                <div key={delivery.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          delivery.status === 'DRAFT' ? 'bg-yellow-400' :
                          delivery.status === 'CONFIRMED' ? 'bg-blue-400' :
                          'bg-green-400'
                        }`}></div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {delivery.customers.map((pc: { customer: { name: string } }) => pc.customer.name).join(', ')}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {delivery.customers[0]?.customer.type}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        delivery.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                        delivery.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {delivery.status}
                      </span>
                    </div>

                    {delivery.notes && (
                      <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded">
                        {delivery.notes}
                      </p>
                    )}

                    <div className="space-y-2">
                      {delivery.items.map((item: DeliveryItem, index: number) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex-1">
                            <span className="text-gray-900 font-medium">{item.item.name}</span>
                            <span className="text-gray-500 ml-2">({item.item.category?.name || 'No Category'})</span>
                            {item.note && (
                              <p className="text-xs text-gray-600 mt-1">{item.note}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-gray-900">{item.quantity}</span>
                            {item.item.unit && (
                              <span className="text-xs text-gray-500 ml-1">{item.item.unit}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Deliveries Message */}
        {deliveries.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No deliveries scheduled</h3>
            <p className="text-gray-500 mb-4">There are no deliveries planned for this date.</p>
            <Link
              href="/factory"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Delivery Plan
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';

type DeliveryItem = {
  quantity: number;
  note?: string;
  item: {
    name: string;
    unit?: string;
    category?: { name: string } | null;
  };
};

type DeliveryPlan = {
  id: string;
  date: string;
  status: string;
  notes?: string;
  store?: { name: string; slug: string };
  customers: { customer: { name: string; type: string } }[];
  items: DeliveryItem[];
};

export default function StaffDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodaysDeliveries();
  }, []);

  const fetchTodaysDeliveries = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(`/api/delivery-plans?status=CONFIRMED&date=${today}`);
      if (!response.ok) {
        throw new Error('Failed to fetch deliveries');
      }
      const todaysDeliveries = await response.json();

      setDeliveries(todaysDeliveries);
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      setError('Failed to load today&apos;s deliveries');
    } finally {
      setLoading(false);
    }
  };

  const markAsDelivered = async (deliveryId: string) => {
    try {
      const response = await fetch(`/api/delivery-plans/${deliveryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'SENT' }),
      });

      if (response.ok) {
        // Update local state
        setDeliveries(deliveries.map(delivery =>
          delivery.id === deliveryId
            ? { ...delivery, status: 'SENT' }
            : delivery
        ));
      } else {
        alert('Failed to mark as delivered');
      }
    } catch (err) {
      console.error('Error updating delivery:', err);
      alert('Failed to mark as delivered');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading today&apos;s deliveries...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4 flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {error}
          </div>
          <button
            onClick={fetchTodaysDeliveries}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const pendingDeliveries = deliveries.filter(d => d.status !== 'SENT');
  const completedDeliveries = deliveries.filter(d => d.status === 'SENT');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Today&apos;s Deliveries</h1>
            <p className="text-xl text-gray-600">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center border-2 border-blue-200">
            <div className="text-3xl font-bold text-blue-600 mb-2">{deliveries.length}</div>
            <div className="text-gray-600">Total Deliveries</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 text-center border-2 border-orange-200">
            <div className="text-3xl font-bold text-orange-600 mb-2">{pendingDeliveries.length}</div>
            <div className="text-gray-600">Pending</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 text-center border-2 border-green-200">
            <div className="text-3xl font-bold text-green-600 mb-2">{completedDeliveries.length}</div>
            <div className="text-gray-600">Completed</div>
          </div>
        </div>

        {/* Pending Deliveries */}
        {pendingDeliveries.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              Pending Deliveries
              <span className="ml-2 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-sm">
                {pendingDeliveries.length}
              </span>
            </h2>

            <div className="space-y-6">
              {pendingDeliveries.map((delivery) => (
                <div key={delivery.id} className="bg-white rounded-lg shadow-sm border-2 border-orange-200 p-6">
                  {/* Destination */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {delivery.store?.name ||
                           delivery.customers.map(pc => pc.customer.name).join(', ')}
                        </h3>
                        <p className="text-gray-600">
                          {delivery.store ? 'Store' : delivery.customers[0]?.customer.type || 'Customer'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        delivery.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {delivery.status}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {delivery.notes && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-700">{delivery.notes}</p>
                    </div>
                  )}

                  {/* Items */}
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Items to Deliver:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {delivery.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div className="flex-1">
                            <span className="font-medium text-gray-900">{item.item.name}</span>
                            <div className="text-sm text-gray-600">
                              {item.item.category?.name || 'No Category'}
                              {item.note && <span className="ml-2">• {item.note}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-blue-600">
                              {item.quantity}
                            </span>
                            {item.item.unit && (
                              <span className="text-sm text-gray-500 ml-1">
                                {item.item.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => markAsDelivered(delivery.id)}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-lg"
                    >
                      Mark as Delivered
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Deliveries */}
        {completedDeliveries.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              Completed Deliveries
              <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                {completedDeliveries.length}
              </span>
            </h2>

            <div className="space-y-4">
              {completedDeliveries.map((delivery) => (
                <div key={delivery.id} className="bg-white rounded-lg shadow-sm border-2 border-green-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">
                          {delivery.store?.name ||
                           delivery.customers.map(pc => pc.customer.name).join(', ')}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {delivery.items.length} items delivered
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      DELIVERED
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Deliveries */}
        {deliveries.length === 0 && (
          <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No deliveries today!</h3>
            <p className="text-gray-600 mb-6">You have no deliveries scheduled for today.</p>
            <div className="text-sm text-gray-500">
              Enjoy your day off!
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <div className="text-center mt-8">
          <button
            onClick={fetchTodaysDeliveries}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Refresh Deliveries
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface Order {
  id: string;
  supplier?: {
    name: string;
  };
  status: 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED';
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  totalAmount?: number;
  currency: string;
  notes?: string;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  item: {
    id: string;
    name: string;
    category: {
      name: string;
    };
  };
  quantity: number;
  unit: string;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivedQuantities, setReceivedQuantities] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800';
      case 'RECEIVED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DRAFT': return <Clock className="h-4 w-4" />;
      case 'PENDING': return <AlertCircle className="h-4 w-4" />;
      case 'CONFIRMED': return <Package className="h-4 w-4" />;
      case 'RECEIVED': return <CheckCircle className="h-4 w-4" />;
      case 'CANCELLED': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleReceiveOrder = (order: Order) => {
    setSelectedOrder(order);
    // Initialize received quantities with ordered quantities
    const initialQuantities: { [key: string]: number } = {};
    order.items.forEach(item => {
      initialQuantities[item.id] = item.quantity;
    });
    setReceivedQuantities(initialQuantities);
    setShowReceiveModal(true);
  };

  const updateReceivedQuantity = (itemId: string, quantity: number) => {
    setReceivedQuantities(prev => ({
      ...prev,
      [itemId]: quantity
    }));
  };

  const submitStockReceipt = async () => {
    if (!selectedOrder) return;

    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedItems: Object.entries(receivedQuantities).map(([itemId, quantity]) => ({
            itemId,
            receivedQuantity: quantity
          }))
        })
      });

      if (response.ok) {
        setShowReceiveModal(false);
        setSelectedOrder(null);
        setReceivedQuantities({});
        loadOrders(); // Refresh the orders list
        alert('Stock receipt recorded successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to record stock receipt: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to record stock receipt:', error);
      alert('Failed to record stock receipt');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-8 w-8 text-blue-600" />
            Orders & Stock Receipts
          </h1>
          <p className="text-gray-600 mt-2">Manage supplier orders and record incoming stock</p>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">All Orders</h2>
          <p className="text-gray-600 mt-1">Track order status and receive incoming stock</p>
        </div>

        <div className="p-6">
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No orders found</h3>
              <p className="text-gray-500">Orders will appear here once created.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          Ordered: {new Date(order.orderDate).toLocaleDateString()}
                        </span>
                        {order.expectedDate && (
                          <span className="text-sm text-gray-500">
                            Expected: {new Date(order.expectedDate).toLocaleDateString()}
                          </span>
                        )}
                        {order.receivedDate && (
                          <span className="text-sm text-green-600">
                            Received: {new Date(order.receivedDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900">
                        {order.supplier?.name || 'No Supplier'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''} •
                        Total: {order.totalAmount ? `${order.currency} ${order.totalAmount.toFixed(2)}` : 'Not specified'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {order.status !== 'RECEIVED' && order.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleReceiveOrder(order)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                        >
                          <Truck className="h-4 w-4" />
                          Receive Stock
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="bg-gray-50 p-3 rounded-lg">
                        <h4 className="font-medium text-gray-900">{item.item.name}</h4>
                        <p className="text-sm text-gray-600">{item.item.category.name}</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm">
                            Ordered: {item.quantity} {item.unit}
                          </span>
                          {item.unitPrice && (
                            <span className="text-sm text-gray-600">
                              {order.currency} {item.unitPrice.toFixed(2)}/{item.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">{order.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Receive Stock Modal */}
      {showReceiveModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Receive Stock</h2>
                <button
                  onClick={() => setShowReceiveModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Order Details</h3>
                  <p className="text-sm text-gray-600">
                    Supplier: {selectedOrder.supplier?.name || 'No Supplier'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Ordered: {new Date(selectedOrder.orderDate).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Record Received Quantities</h3>
                  <div className="space-y-4">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="font-medium">{item.item.name}</h4>
                          <p className="text-sm text-gray-600">{item.item.category.name}</p>
                          <p className="text-sm text-gray-500">Ordered: {item.quantity} {item.unit}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Received:</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={receivedQuantities[item.id] || 0}
                              onChange={(e) => updateReceivedQuantity(item.id, parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 text-sm border rounded"
                            />
                            <span className="text-sm text-gray-600">{item.unit}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t">
                  <button
                    onClick={() => setShowReceiveModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitStockReceipt}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
                  >
                    Record Stock Receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

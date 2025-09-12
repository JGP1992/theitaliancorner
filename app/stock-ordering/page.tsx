'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, AlertTriangle, Plus, Truck } from 'lucide-react';

interface Stocktake {
  id: string;
  date: string;
  store: {
    name: string;
  };
  items: StocktakeItem[];
}

interface Item {
  id: string;
  name: string;
  category: {
    name: string;
  };
  targetNumber?: number;
  targetText?: string;
  unit?: string;
}

interface StocktakeItem {
  id: string;
  itemId: string;
  quantity?: number;
  note?: string;
  stocktake: {
    date: string;
    store: {
      name: string;
    };
  };
}

interface LowStockItem extends Item {
  currentStock: number;
  lastStocktake: string;
  storeName: string;
}

interface OrderItem {
  itemId: string;
  item: Item;
  quantity: number;
  unit: string;
  unitPrice?: number;
}

export default function StockOrderingPage() {
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    loadLowStockItems();
  }, []);

  const loadLowStockItems = async () => {
    try {
      // Get latest stocktakes
      const stocktakeResponse = await fetch('/api/stocktakes?limit=50');
      const stocktakes: Stocktake[] = await stocktakeResponse.json();

      // Get all items
      const itemsResponse = await fetch('/api/items');
      const items: Item[] = await itemsResponse.json();

      // Calculate current stock levels and identify low stock items
      const lowStock: LowStockItem[] = [];

      items.forEach((item: Item) => {
        // Find the most recent stocktake for this item
        const recentStocktakes = stocktakes
          .filter((st: Stocktake) => st.items.some((si: StocktakeItem) => si.itemId === item.id))
          .sort((a: Stocktake, b: Stocktake) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (recentStocktakes.length > 0) {
          const latestStocktake = recentStocktakes[0];
          const stocktakeItem = latestStocktake.items.find((si: StocktakeItem) => si.itemId === item.id);

          if (stocktakeItem && stocktakeItem.quantity !== null && stocktakeItem.quantity !== undefined) {
            const currentStock = stocktakeItem.quantity;
            const targetStock = item.targetNumber || 1;

            // Consider low stock if current is less than target
            if (currentStock < targetStock) {
              lowStock.push({
                ...item,
                currentStock,
                lastStocktake: new Date(latestStocktake.date).toLocaleDateString(),
                storeName: latestStocktake.store.name
              });
            }
          }
        }
      });

      setLowStockItems(lowStock);
    } catch (error) {
      console.error('Failed to load low stock items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToOrder = (item: LowStockItem) => {
    const existingItem = orderItems.find(oi => oi.itemId === item.id);
    if (existingItem) {
      setOrderItems(orderItems.map(oi =>
        oi.itemId === item.id
          ? { ...oi, quantity: oi.quantity + 1 }
          : oi
      ));
    } else {
      const targetQuantity = item.targetNumber || 1;
      const orderQuantity = Math.max(targetQuantity - item.currentStock, 1);

      setOrderItems([...orderItems, {
        itemId: item.id,
        item,
        quantity: orderQuantity,
        unit: item.unit || 'units'
      }]);
    }
  };

  const removeFromOrder = (itemId: string) => {
    setOrderItems(orderItems.filter(oi => oi.itemId !== itemId));
  };

  const updateOrderQuantity = (itemId: string, quantity: number) => {
    setOrderItems(orderItems.map(oi =>
      oi.itemId === itemId ? { ...oi, quantity } : oi
    ));
  };

  const createOrder = async () => {
    if (orderItems.length === 0) return;

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderItems
        })
      });

      if (response.ok) {
        setShowOrderForm(false);
        setOrderItems([]);
        alert('Order created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create order: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order');
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
            <ShoppingCart className="h-8 w-8 text-blue-600" />
            Stock Ordering
          </h1>
          <p className="text-gray-600 mt-2">Manage low stock items and create supplier orders</p>
        </div>
        <button
          onClick={() => setShowOrderForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          disabled={orderItems.length === 0}
        >
          <Truck className="h-5 w-5" />
          Create Order ({orderItems.length})
        </button>
      </div>

      {/* Current Order Summary */}
      {orderItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Current Order</h3>
          <div className="space-y-2">
            {orderItems.map((item) => (
              <div key={item.itemId} className="flex justify-between items-center">
                <span className="text-sm">{item.item.name}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={item.quantity}
                    onChange={(e) => updateOrderQuantity(item.itemId, parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 text-sm border rounded"
                  />
                  <span className="text-sm text-gray-600">{item.unit}</span>
                  <button
                    onClick={() => removeFromOrder(item.itemId)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock Items */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Low Stock Items
          </h2>
          <p className="text-gray-600 mt-1">Items that need to be reordered</p>
        </div>

        <div className="p-6">
          {lowStockItems.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">All stock levels are good!</h3>
              <p className="text-gray-500">No items are currently low on stock.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lowStockItems.map((item) => (
                <div key={item.id} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-600">{item.category.name}</p>
                    </div>
                    <button
                      onClick={() => addToOrder(item)}
                      className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600"
                      title="Add to order"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Stock:</span>
                      <span className="font-medium text-orange-700">
                        {item.currentStock} {item.unit || 'units'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Target:</span>
                      <span className="font-medium">
                        {item.targetNumber || 1} {item.unit || 'units'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Store:</span>
                      <span>{item.storeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Check:</span>
                      <span>{item.lastStocktake}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Creation Modal */}
      {showOrderForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Order</h2>
                <button
                  onClick={() => setShowOrderForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Order Items</h3>
                  {orderItems.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      No items in order. Add some low stock items first.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {orderItems.map((item) => (
                        <div key={item.itemId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">{item.item.name}</p>
                            <p className="text-sm text-gray-600">{item.item.category.name}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={item.quantity}
                                onChange={(e) => updateOrderQuantity(item.itemId, parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 text-sm border rounded"
                              />
                              <span className="text-sm text-gray-600">{item.unit}</span>
                            </div>
                            <button
                              onClick={() => removeFromOrder(item.itemId)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t">
                  <button
                    onClick={() => setShowOrderForm(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createOrder}
                    disabled={orderItems.length === 0}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Create Order
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

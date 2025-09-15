'use client';

import '../globals.css';

import { useState, useEffect, useRef } from 'react';
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
  const [unitOptions, setUnitOptions] = useState<string[]>(['units', 'kg', 'g', 'L', 'ml', 'tub', 'cup', 'tray', 'box', 'case']);
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Helpers: normalize unit labels and filter out IDs mistakenly appearing as units
  const isProbablyId = (s: string) => /^[a-z0-9_-]{20,}$/i.test(s); // e.g., cuid-like strings
  const normalizeUnit = (u?: string | null): string | null => {
    if (!u) return null;
    const raw = u.trim();
    if (!raw) return null;
    if (isProbablyId(raw)) return null; // drop id-like tokens
    const lower = raw.toLowerCase();
    // canonical mappings
    const map: Record<string, string> = {
      kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
      g: 'g', gram: 'g', grams: 'g',
      l: 'L', lt: 'L', litre: 'L', liters: 'L', liter: 'L', litres: 'L',
      ml: 'ml',
      unit: 'units', units: 'units',
      tub: 'tub', tubs: 'tub',
      cup: 'cup', cups: 'cup',
      tray: 'tray', trays: 'tray',
      box: 'box', boxes: 'box',
      case: 'case', cases: 'case',
      carton: 'carton', cartons: 'carton',
      pack: 'pack', packs: 'pack',
      dozen: 'dozen',
      sleeve: 'sleeve', sleeves: 'sleeve'
    };
    return map[lower] || raw; // keep as-is if not mapped
  };

  // Unit behavior helpers
  const COUNT_UNITS = new Set(['unit', 'units', 'tub', 'cup', 'tray', 'box', 'case', 'carton', 'pack', 'dozen', 'sleeve']);
  const isCountUnit = (u?: string | null) => !!(u && COUNT_UNITS.has(u.toLowerCase()));
  const inputStepFor = (u?: string | null) => {
    if (isCountUnit(u)) return 1;
    if (!u) return 0.1;
    const lu = u.toLowerCase();
    if (lu === 'g' || lu === 'ml') return 1; // integer grams and ml
    return 0.1; // kg/L and general numeric units
  };
  const inputMinFor = (u?: string | null) => (isCountUnit(u) ? 1 : (u && (u.toLowerCase() === 'g' || u.toLowerCase() === 'ml') ? 1 : 0.1));

  useEffect(() => {
    loadLowStockItems();
  }, []);

  const loadLowStockItems = async () => {
    try {
      // Fetch aggregated inventory with per-item thresholds and all items for id/unit mapping
      const [planRes, itemsRes] = await Promise.all([
        fetch('/api/production-plan'),
        fetch('/api/items')
      ]);

      const planData = await planRes.json();
  const items: Item[] = await itemsRes.json();

      type InventoryEntry = {
        itemName: string;
        category: string;
        totalQuantity: number;
        lastUpdated: string;
        targetThreshold?: number;
        stocktakes: Array<{ store: string; quantity: number; date: string }>
      };

      const inventory: InventoryEntry[] = planData?.inventory || [];

      // Build a lookup map for items by name+category
      const itemByNameCat = new Map<string, Item>();
      const unitsSet = new Set<string>(unitOptions);
      items.forEach((it) => {
        const key = `${it.name}|${it.category?.name || ''}`;
        itemByNameCat.set(key, it);
        const nu = normalizeUnit(it.unit);
        if (nu) unitsSet.add(nu);
      });
      setUnitOptions(Array.from(unitsSet));

      const lowStock: LowStockItem[] = [];

      for (const inv of inventory) {
        const key = `${inv.itemName}|${inv.category || ''}`;
        const baseItem = itemByNameCat.get(key);
        if (!baseItem) {
          // If we can't map to an actual item (no id), skip as we can't create an order line
          continue;
        }

        const threshold = inv.targetThreshold ?? baseItem.targetNumber ?? 5;
        const currentStock = inv.totalQuantity ?? 0;

        if (currentStock < threshold) {
          // Determine most recent stocktake info for display
          let lastStocktake = '';
          let storeName = '';
          if (inv.stocktakes && inv.stocktakes.length > 0) {
            const latest = inv.stocktakes.reduce((a, b) => (a.date > b.date ? a : b));
            lastStocktake = new Date(latest.date).toLocaleDateString();
            storeName = latest.store;
          } else {
            lastStocktake = new Date(inv.lastUpdated).toLocaleDateString();
            storeName = '—';
          }

          lowStock.push({
            ...baseItem,
            // Show the effective threshold as the target so UI is consistent
            targetNumber: threshold,
            currentStock,
            lastStocktake,
            storeName
          });
        }
      }

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
      const targetQuantity = item.targetNumber ?? 1;
      const delta = (targetQuantity - item.currentStock);
      const defaultUnit = normalizeUnit(item.unit) || 'units';
      const orderQuantity = (() => {
        if (isCountUnit(defaultUnit)) {
          return Math.max(Math.ceil(delta), 1);
        }
        const step = inputStepFor(defaultUnit);
        // Round to nearest step for weight/volume
        const rounded = step === 1 ? Math.round(delta) : Math.round(delta / step) * step;
        return Math.max(rounded, inputMinFor(defaultUnit));
      })();
      setOrderItems([...orderItems, {
        itemId: item.id,
        item,
        quantity: orderQuantity,
        unit: defaultUnit
      }]);
    }
  };

  const removeFromOrder = (itemId: string) => {
    setOrderItems(orderItems.filter(oi => oi.itemId !== itemId));
  };

  const updateOrderQuantity = (itemId: string, quantity: number) => {
    setOrderItems(orderItems.map(oi => {
      if (oi.itemId !== itemId) return oi;
      const u = oi.unit;
      let q = quantity;
      if (isCountUnit(u)) {
        q = Math.max(Math.round(q), 1);
      } else {
        const step = inputStepFor(u);
        const min = inputMinFor(u);
        if (step === 1) {
          q = Math.round(q);
        } else {
          q = Math.round(q / step) * step;
        }
        q = Math.max(q, min);
      }
      return { ...oi, quantity: q };
    }));
  };

  const updateOrderUnit = (itemId: string, unit: string) => {
    setOrderItems(orderItems.map(oi =>
      oi.itemId === itemId ? { ...oi, unit } : oi
    ));
  };

  const onChangeUnit = (itemId: string, value: string, currentUnit: string, selectEl?: HTMLSelectElement) => {
    if (value === '__custom__') {
      const custom = prompt('Enter custom unit label (e.g., dozen, sleeves, cartons):', currentUnit || '');
      if (custom && custom.trim()) {
        const trimmed = custom.trim();
        if (!unitOptions.includes(trimmed)) {
          setUnitOptions((prev) => Array.from(new Set([...prev, trimmed])));
        }
        updateOrderUnit(itemId, trimmed);
      } else {
        // Revert to current unit if cancelled
        updateOrderUnit(itemId, currentUnit);
      }
      // Close the dropdown and move focus to quantity input (mobile friendly)
      setTimeout(() => {
        try {
          if (selectEl) selectEl.blur();
          qtyRefs.current[itemId]?.focus();
        } catch {}
      }, 0);
      return;
    }
    updateOrderUnit(itemId, value);
    setTimeout(() => {
      try {
        if (selectEl) selectEl.blur();
        qtyRefs.current[itemId]?.focus();
      } catch {}
    }, 0);
  };

  const createOrder = async () => {
    if (orderItems.length === 0) return;

    // Basic validation: all quantities must be > 0
    const invalid = orderItems.find((oi) => !(typeof oi.quantity === 'number' && oi.quantity > 0));
    if (invalid) {
      alert(`Please enter a quantity greater than 0 for '${invalid.item.name}'.`);
      return;
    }

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
                    min={inputMinFor(item.unit)}
                    step={inputStepFor(item.unit)}
                    value={item.quantity}
                    onChange={(e) => updateOrderQuantity(item.itemId, parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 text-sm border rounded"
                    ref={(el) => { qtyRefs.current[item.itemId] = el; }}
                  />
                  <select
                    value={item.unit}
                    onChange={(e) => onChangeUnit(item.itemId, e.target.value, item.unit, e.currentTarget)}
                    className="px-2 py-1 text-sm border rounded bg-white"
                  >
                    {unitOptions.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="__custom__">Custom…</option>
                  </select>
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
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-600 shrink-0">Target:</span>
                      <span className="font-medium text-right whitespace-normal break-words">
                        {(() => {
                          const targetDisplay = item.targetText ?? (
                            item.targetNumber != null
                              ? `${item.targetNumber}${item.unit ? ` ${item.unit}` : ''}`
                              : null
                          );
                          return targetDisplay || `${1} ${item.unit || 'units'}`;
                        })()}
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
                                min={inputMinFor(item.unit)}
                                step={inputStepFor(item.unit)}
                                value={item.quantity}
                                onChange={(e) => updateOrderQuantity(item.itemId, parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 text-sm border rounded"
                                ref={(el) => { qtyRefs.current[item.itemId] = el; }}
                              />
                              <select
                                value={item.unit}
                                onChange={(e) => onChangeUnit(item.itemId, e.target.value, item.unit, e.currentTarget)}
                                className="px-2 py-1 text-sm border rounded bg-white"
                              >
                                {unitOptions.map((u) => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                                <option value="__custom__">Custom…</option>
                              </select>
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

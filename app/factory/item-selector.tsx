'use client';

import { useState, useEffect, useRef } from 'react';

type Item = {
  id: string;
  name: string;
  category: string;
  unit?: string;
  targetNumber?: number;
  defaultQuantity?: number;
};

type SelectedItem = {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  packagingOptionId?: string;
  weightKg?: number;
};

interface ItemSelectorProps {
  selectedItems: SelectedItem[];
  onItemsChange: (items: SelectedItem[]) => void;
  destinationName: string;
  destinationType?: 'store' | 'customer';
  showPackaging?: boolean; // when false, hide packaging UI and skip packaging fetches
}

type CategoryResponse = {
  name: string;
  items: {
    id: string;
    name: string;
    unit?: string;
    targetNumber?: number;
  }[];
};

function ItemSelector({ selectedItems, onItemsChange, destinationName, destinationType = 'store', showPackaging = true }: ItemSelectorProps) {
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<Array<{ id: string; name: string; type: string; sizeValue: number | null; sizeUnit: string | null; variableWeight: boolean }>>([]);
  const packagingCache = useRef<Record<string, Array<{ id: string; name: string; type: string; sizeValue: number | null; sizeUnit: string | null; variableWeight: boolean }>>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
  const fetchItems = async () => {
      try {
        const response = await fetch('/api/items', { credentials: 'include' });
        const raw = await response.json();

        let flattenedItems: Item[] = [];

        // Shape 1: Category array with nested items
        if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object' && 'items' in raw[0]) {
          const data = raw as CategoryResponse[];
          flattenedItems = data.flatMap((category) =>
            (category.items || []).map((item) => ({
              id: item.id,
              name: item.name,
              category: category.name,
              unit: item.unit,
              targetNumber: item.targetNumber,
              defaultQuantity: (item as any).defaultQuantity
            }))
          );
        }

        // Shape 2: Flat items array with optional category object
        if (Array.isArray(raw) && (flattenedItems.length === 0)) {
          flattenedItems = (raw as Array<any>).map((it) => ({
            id: String(it.id),
            name: String(it.name),
            category: (it.category && it.category.name) ? String(it.category.name) : 'Uncategorized',
            unit: it.unit ? String(it.unit) : undefined,
            targetNumber: typeof it.targetNumber === 'number' ? it.targetNumber : undefined,
            defaultQuantity: typeof it.defaultQuantity === 'number' ? it.defaultQuantity : undefined,
          }));
        }

        setAvailableItems(flattenedItems || []);
        // Optionally fetch global packaging options (fallback list)
        if (showPackaging) {
          try {
            const pRes = await fetch(`/api/packaging-options${destinationType ? `?audience=${destinationType}` : ''}` as string, { credentials: 'include' });
            if (pRes.ok) {
              const opts = await pRes.json();
              setPackagingOptions(opts || []);
            }
          } catch {}
        }
      } catch (error) {
        console.error('Failed to fetch items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [destinationType, showPackaging]);

  const filteredItems = availableItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = (item: Item) => {
    if (!selectedItems.find(selected => selected.id === item.id)) {
      const newItem: SelectedItem = {
        id: item.id,
        name: item.name,
        // Default to 1 for deliveries; ignore targetNumber to avoid confusion
        quantity: (typeof item.defaultQuantity === 'number' && item.defaultQuantity > 0) ? item.defaultQuantity : 1,
        unit: item.unit
      };
      onItemsChange([...selectedItems, newItem]);
      // Optionally preload packaging for this item if gelato, to make selection smooth
      const isGelato = typeof item.category === 'string' && item.category.toLowerCase().includes('gelato');
      if (showPackaging && isGelato && !packagingCache.current[item.id]) {
        const query = new URLSearchParams();
        if (destinationType) query.set('audience', destinationType);
        query.set('itemId', item.id);
        const baseline = [...selectedItems, newItem];
        fetch(`/api/packaging-options?${query.toString()}`, { credentials: 'include' })
          .then((r) => r.ok ? r.json() : [])
          .then((opts: Array<any>) => {
            packagingCache.current[item.id] = opts || [];
            // If there is a default packaging, auto-select it for this item
            let defaultOpt: any = undefined;
            if (destinationType === 'store') {
              defaultOpt = (opts || []).find((o) => o.isDefaultForStores) || (opts || []).find((o) => o.isDefault);
            } else if (destinationType === 'customer') {
              defaultOpt = (opts || []).find((o) => o.isDefaultForCustomers) || (opts || []).find((o) => o.isDefault);
            } else {
              defaultOpt = (opts || []).find((o) => o.isDefault);
            }
            if (defaultOpt) {
              const updated = baseline.map((si) => si.id === item.id ? { ...si, packagingOptionId: defaultOpt.id } : si);
              onItemsChange(updated);
            }
          })
          .catch(() => {});
      }
    }
    setSearchTerm('');
    setShowDropdown(false);
    searchRef.current?.focus();
  };

  const removeItem = (itemId: string) => {
    onItemsChange(selectedItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    onItemsChange(selectedItems.map(item =>
      item.id === itemId ? { ...item, quantity: Math.max(0, quantity) } : item
    ));
  };

  const updatePackaging = (itemId: string, packagingOptionId: string) => {
    onItemsChange(selectedItems.map(item =>
      item.id === itemId ? { ...item, packagingOptionId, weightKg: undefined } : item
    ));
  };

  const updateWeight = (itemId: string, weightKg: number) => {
    onItemsChange(selectedItems.map(item =>
      item.id === itemId ? { ...item, weightKg: weightKg > 0 ? weightKg : undefined } : item
    ));
  };

  const groupedItems = filteredItems.reduce((groups, item) => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
    return groups;
  }, {} as Record<string, Item[]>);

  return (
    <div className="space-y-4">
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add Items for {destinationName}
        </label>
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowDropdown(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search items by name or category..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-center text-gray-500">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm">Loading items...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-3 text-center text-gray-500">
                <p className="text-sm">No items found</p>
              </div>
            ) : (
              <div className="py-1">
                {Object.entries(groupedItems).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                        {category}
                      </span>
                    </div>
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          addItem(item);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none flex items-center justify-between"
                      >
                        <div>
                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          {item.unit && (
                            <span className="text-xs text-gray-500 ml-2">({item.unit})</span>
                          )}
                        </div>
                        {selectedItems.find(selected => selected.id === item.id) && (
                          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Click outside to close dropdown */}
        {showDropdown && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>

      {/* Selected Items List */}
      {selectedItems.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700">Selected Items:</h5>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedItems.map((item) => {
              const itemMeta = availableItems.find(ai => ai.id === item.id);
              const isGelato = !!itemMeta && typeof itemMeta.category === 'string' && itemMeta.category.toLowerCase().includes('gelato');
              const itemPackaging = (showPackaging ? (packagingCache.current[item.id] || packagingOptions) : []);
              const selectedPackaging = itemPackaging.find(po => po.id === item.packagingOptionId) || packagingOptions.find(po => po.id === item.packagingOptionId);
              const formatPackLabel = (p?: { type: string; sizeValue: number | null; sizeUnit: string | null; name: string }) => {
                if (!p) return '';
                const unitRaw = (p.sizeUnit || '').toLowerCase();
                const unit = unitRaw === 'ml' ? 'ml' : unitRaw === 'l' ? 'L' : unitRaw === 'kg' ? 'kg' : unitRaw;
                const size = p.sizeValue != null ? `${p.sizeValue}${unit ? unit : ''}` : '';
                const type = p.type ? p.type.charAt(0) + p.type.slice(1).toLowerCase() : '';
                return size ? `${size} ${type}` : (type || p.name);
              };
              return (
              <div key={item.id} className="flex items-start justify-between bg-gray-50 rounded-md p-3">
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                  </div>
                  {/* Packaging and optional weight */}
                  {showPackaging && isGelato && (itemPackaging.length > 0) && (
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={item.packagingOptionId || ''}
                        onChange={(e) => updatePackaging(item.id, e.target.value || '')}
                        className="border border-gray-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="">Select packaging</option>
                        {itemPackaging.map((p) => {
                          // Build clean label like: "Tub 5L", "Tray 2.5kg", "Cup 125ml"
                          const unitRaw = (p.sizeUnit || '').toLowerCase();
                          const unit = unitRaw === 'ml' ? 'ml' : unitRaw === 'l' ? 'L' : unitRaw === 'kg' ? 'kg' : unitRaw;
                          const size = p.sizeValue != null ? `${p.sizeValue}${unit ? unit : ''}` : '';
                          const type = p.type ? p.type.charAt(0) + p.type.slice(1).toLowerCase() : '';
                          const label = size ? `${type || p.name} ${size}` : (type || p.name);
                          return (
                            <option key={p.id} value={p.id}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      {(() => {
                        const p = selectedPackaging;
                        const needsWeight = Boolean(p?.variableWeight);
                        // Weight can be captured later during loading; don't hard-block here
                        if (needsWeight) {
                          return (
                            <div className="flex flex-col">
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0.01"
                                value={item.weightKg ?? ''}
                                onChange={(e) => updateWeight(item.id, parseFloat(e.target.value) || 0)}
                                placeholder="Weight per unit (kg)"
                                className="w-28 border border-gray-300 rounded px-2 py-1 text-xs"
                              />
                              <span className="text-[11px] text-gray-500 mt-1">Optional now • required before dispatch</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <div className="text-[11px] text-gray-600 self-start">
                    Qty{selectedPackaging ? ` (${formatPackLabel(selectedPackaging)})` : (itemMeta?.unit ? ` (${itemMeta.unit})` : '')}
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step={selectedPackaging ? 1 : 'any'}
                    value={Number.isFinite(item.quantity) ? item.quantity : ''}
                    onChange={(e) => {
                      e.preventDefault();
                      const val = e.currentTarget.value;
                      let num = val === '' ? NaN : Number(val);
                      if (!Number.isFinite(num)) num = 0;
                      // For packaged items (tubs/trays/cups), normalize to whole units
                      if (selectedPackaging) {
                        num = Math.max(0, Math.floor(num));
                      }
                      updateQuantity(item.id, num);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {(!(typeof item.quantity === 'number' && item.quantity > 0)) && (
                    <span className="text-[11px] text-red-600">Qty must be greater than 0.</span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Remove item"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );})}
          </div>
        </div>
      )}
    </div>
  );
}

export default ItemSelector;

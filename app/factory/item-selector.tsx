'use client';

import { useState, useEffect, useRef } from 'react';

type Item = {
  id: string;
  name: string;
  category: string;
  unit?: string;
  targetNumber?: number;
};

type SelectedItem = {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
};

interface ItemSelectorProps {
  selectedItems: SelectedItem[];
  onItemsChange: (items: SelectedItem[]) => void;
  destinationName: string;
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

function ItemSelector({ selectedItems, onItemsChange, destinationName }: ItemSelectorProps) {
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items');
        const data: CategoryResponse[] = await response.json();
        const flattenedItems = data.flatMap((category: CategoryResponse) =>
          category.items.map((item) => ({
            id: item.id,
            name: item.name,
            category: category.name,
            unit: item.unit,
            targetNumber: item.targetNumber
          }))
        );
        setAvailableItems(flattenedItems);
      } catch (error) {
        console.error('Failed to fetch items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  const filteredItems = availableItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = (item: Item) => {
    if (!selectedItems.find(selected => selected.id === item.id)) {
      const newItem: SelectedItem = {
        id: item.id,
        name: item.name,
        quantity: item.targetNumber || 1,
        unit: item.unit
      };
      onItemsChange([...selectedItems, newItem]);
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
            {selectedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-md p-3">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  {item.unit && (
                    <span className="text-xs text-gray-500 ml-2">({item.unit})</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={item.quantity}
                    onChange={(e) => {
                      e.preventDefault();
                      updateQuantity(item.id, parseFloat(e.target.value) || 0);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ItemSelector;

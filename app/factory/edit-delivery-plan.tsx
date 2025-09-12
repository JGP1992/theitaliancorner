'use client';

import { useState, useEffect } from 'react';

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

type Item = {
  id: string;
  name: string;
  category: string;
  unit?: string;
  targetNumber?: number;
};

type EditDeliveryPlanProps = {
  plan: DeliveryPlan;
  onClose: () => void;
  onSave: (updatedPlan: DeliveryPlan) => void;
};

function EditDeliveryPlan({ plan, onClose, onSave }: EditDeliveryPlanProps) {
  const [status, setStatus] = useState(plan.status);
  const [notes, setNotes] = useState(plan.notes || '');
  const [items, setItems] = useState(plan.items);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items');
        const data = await response.json();
        const flattenedItems = data.flatMap((category: { name: string; items: Array<{ id: string; name: string; unit?: string; targetNumber?: number }> }) =>
          category.items.map((item: { id: string; name: string; unit?: string; targetNumber?: number }) => ({
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
      }
    };

    fetchItems();
  }, []);

  const filteredItems = availableItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = (item: Item) => {
    if (!items.find(selected => selected.item.id === item.id)) {
      const newItem = {
        id: `temp-${Date.now()}`,
        quantity: item.targetNumber || 1,
        note: '',
        item: {
          id: item.id,
          name: item.name,
          unit: item.unit,
          category: { name: item.category }
        }
      };
      setItems([...items, newItem]);
    }
    setSearchTerm('');
    setShowDropdown(false);
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setItems(items.map(item =>
      item.item.id === itemId ? { ...item, quantity: Math.max(0, quantity) } : item
    ));
  };

  const updateNote = (itemId: string, note: string) => {
    setItems(items.map(item =>
      item.item.id === itemId ? { ...item, note } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const updateData = {
        id: plan.id,
        status,
        notes: notes.trim() || null,
        items: items.map(item => ({
          itemId: item.item.id,
          quantity: item.quantity,
          note: item.note || null,
        }))
      };

      const response = await fetch(`/api/delivery/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('Failed to update delivery plan');
      }

      const updatedPlan = await response.json();
      onSave(updatedPlan);
      onClose();
    } catch (error) {
      console.error('Error updating delivery plan:', error);
      alert('Failed to update delivery plan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupedItems = filteredItems.reduce((groups, item) => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
    return groups;
  }, {} as Record<string, Item[]>);

  const destinationName = plan.store?.name ||
    (plan.customers.length > 0 ? plan.customers.map(pc => pc.customer.name).join(', ') : 'Unknown');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Edit Delivery Plan - {destinationName}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Plan Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={new Date(plan.date).toISOString().slice(0, 10)}
                disabled
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'CONFIRMED' | 'SENT')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="DRAFT">Draft</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="SENT">Sent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this delivery..."
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Items Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Items</h3>

            {/* Add Item Search */}
            <div className="relative mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search items to add..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {showDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredItems.length === 0 ? (
                    <div className="px-4 py-3 text-center text-gray-500">
                      <p className="text-sm">No items found</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {Object.entries(groupedItems).map(([category, categoryItems]) => (
                        <div key={category}>
                          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                            <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                              {category}
                            </span>
                          </div>
                          {categoryItems.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => addItem(item)}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none flex items-center justify-between"
                            >
                              <div>
                                <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                {item.unit && (
                                  <span className="text-xs text-gray-500 ml-2">({item.unit})</span>
                                )}
                              </div>
                              {items.find(selected => selected.item.id === item.id) && (
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

              {showDropdown && (
                <div
                  className="fixed inset-0 z-0"
                  onClick={() => setShowDropdown(false)}
                />
              )}
            </div>

            {/* Selected Items */}
            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500">No items selected</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium text-gray-900">{item.item.name}</span>
                        <span className="text-sm text-gray-500">({item.item.category?.name || 'No Category'})</span>
                        {item.item.unit && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {item.item.unit}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={item.note || ''}
                        onChange={(e) => updateNote(item.item.id, e.target.value)}
                        placeholder="Add note..."
                        className="mt-2 w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.item.id, parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(item.item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove item"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditDeliveryPlan;

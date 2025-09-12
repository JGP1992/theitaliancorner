'use client';

import { useState, useEffect } from 'react';
import ItemSelector from './item-selector';

type Destination = {
  id: string;
  name: string;
  type: 'store' | 'customer';
  slug?: string;
};

type SelectedItem = {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
};

type SubmitResult = {
  success: boolean;
  message?: string;
  error?: string;
  plans?: {
    id: string;
    destination: string;
    date: string;
    status: string;
    itemCount: number;
    items: {
      name: string;
      quantity: number;
      unit?: string;
    }[];
  }[];
};

function QuickDelivery({ customers = [], stores = [] }: { customers?: { id: string; name: string; type: string }[]; stores?: { id: string; name: string; slug: string }[] }) {
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [itemSections, setItemSections] = useState<Destination[]>([]);
  const [destinationItems, setDestinationItems] = useState<Record<string, SelectedItem[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    const allDestinations: Destination[] = [
      ...selectedStores.map((slug: string) => {
        const store = stores.find(s => s.slug === slug);
        return { id: store?.id || '', name: store?.name || '', type: 'store' as const, slug };
      }),
      ...selectedCustomers.map((id: string) => {
        const customer = customers.find(c => c.id === id);
        return { id, name: customer?.name || '', type: 'customer' as const };
      })
    ];
    setItemSections(allDestinations);
  }, [selectedStores, selectedCustomers, stores, customers]);

  // Initialize destination items when destinations change
  useEffect(() => {
    setDestinationItems(prev => {
      const newItems = { ...prev };
      itemSections.forEach(dest => {
        const key = `${dest.type}_${dest.id}`;
        if (!newItems[key]) {
          newItems[key] = [];
        }
      });
      return newItems;
    });
  }, [itemSections]);

  const handleStoreChange = (slug: string, checked: boolean) => {
    if (checked) {
      setSelectedStores((prev: string[]) => [...prev, slug]);
    } else {
      setSelectedStores((prev: string[]) => prev.filter((s: string) => s !== slug));
    }
  };

  const handleCustomerChange = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedCustomers((prev: string[]) => [...prev, id]);
    } else {
      setSelectedCustomers((prev: string[]) => prev.filter((c: string) => c !== id));
    }
  };

  const handleDestinationItemsChange = (destinationKey: string, items: SelectedItem[]) => {
    setDestinationItems(prev => ({
      ...prev,
      [destinationKey]: items
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const formData = new FormData(e.target as HTMLFormElement);
      
      // Add selected stores and customers to form data
      selectedStores.forEach(store => formData.append('stores', store));
      selectedCustomers.forEach(customer => formData.append('customers', customer));
      
      // Add items data for each destination - ensure all items are included
      Object.entries(destinationItems).forEach(([key, items]) => {
        if (items.length > 0) {
          const itemString = items.map(item => `${item.name}:${item.quantity}`).join('\n');
          // Convert the state key to the API-expected key format
          const [type, id] = key.split('_');
          const dest = itemSections.find(d => d.id === id && d.type === type);
          if (dest) {
            const apiKey = `items_${type}_${type === 'store' ? dest.slug : dest.id}`;
            formData.append(apiKey, itemString);
            console.log(`Setting ${apiKey}: ${itemString}`);
          }
        }
      });

      const response = await fetch('/api/create-delivery-plan', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      setSubmitResult(result);
      
      if (result.success) {
        // Reset form on success
        setSelectedStores([]);
        setSelectedCustomers([]);
        setDestinationItems({});
        setItemSections([]);
      }
    } catch {
      setSubmitResult({ success: false, error: 'Failed to submit form' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Quick Delivery Plan</h1>
        <p className="text-gray-600">Create delivery plans for multiple stores and customers</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8" onKeyDown={(e) => {
        // Prevent form submission on Enter key except for the submit button
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'submit') {
          e.preventDefault();
        }
      }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Delivery Date</label>
            <input
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select name="status" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="SENT">Sent</option>
            </select>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Stores</label>
            <p className="text-sm text-gray-600 mb-4">Choose which stores to deliver to</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-4">
              {stores && stores.length > 0 ? (
                stores.map((store) => (
                  <label key={store.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="stores"
                      value={store.slug}
                      checked={selectedStores.includes(store.slug)}
                      onChange={(e) => handleStoreChange(store.slug, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{store.name}</span>
                  </label>
                ))
              ) : (
                <p className="text-gray-500">No stores available</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Customers</label>
            <p className="text-sm text-gray-600 mb-4">Choose which customers to deliver to</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-4">
              {customers && customers.length > 0 ? (
                customers.map((customer) => (
                  <label key={customer.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="customers"
                      value={customer.id}
                      checked={selectedCustomers.includes(customer.id)}
                      onChange={(e) => handleCustomerChange(customer.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{customer.name} ({customer.type})</span>
                  </label>
                ))
              ) : (
                <p className="text-gray-500">No customers available</p>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic item sections */}
        <div className="space-y-6">
          {itemSections.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No destinations selected</h3>
              <p className="text-gray-500">Select stores and/or customers above to add items for each destination</p>
              <p className="text-sm text-gray-400 mt-2">Each destination will receive its own delivery plan with the specified items</p>
            </div>
          ) : (
            itemSections.map((dest: Destination) => {
              const destinationKey = `${dest.type}_${dest.id}`;
              const items = destinationItems[destinationKey] || [];
              return (
                <div key={destinationKey} className="border border-gray-200 rounded-lg p-6 bg-white">
                  <h4 className="font-semibold text-gray-900 mb-4 text-lg">{dest.name} ({dest.type})</h4>
                  <ItemSelector
                    selectedItems={items}
                    onItemsChange={(items) => handleDestinationItemsChange(destinationKey, items)}
                    destinationName={dest.name}
                  />
                  {/* Debug: Show current items */}
                  {items.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      Debug: {items.length} items - {items.map(item => `${item.name}:${item.quantity}`).join(', ')}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {isSubmitting ? 'Creating...' : 'Create Delivery Plans'}
          </button>
        </div>
      </form>

      {/* Submit Result */}
      {submitResult && (
        <div className="mt-8 p-6 border rounded-lg bg-white shadow-sm">
          <h3 className="text-xl font-semibold mb-4">
            {submitResult.success ? 'Success!' : 'Error'}
          </h3>
          {submitResult.success ? (
            <div className="space-y-4">
              <p className="text-green-600 font-medium">{submitResult.message}</p>
              <div className="space-y-4">
                {submitResult.plans?.map((plan, index: number) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-900 mb-2">{plan.destination}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Date:</span> {new Date(plan.date).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span> {plan.status}
                      </div>
                      <div>
                        <span className="font-medium">Items:</span> {plan.itemCount}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 mb-2">Items:</h5>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {plan.items?.map((item, itemIndex: number) => (
                          <li key={itemIndex} className="flex justify-between">
                            <span>{item.name}</span>
                            <span className="font-medium">{item.quantity} {item.unit || ''}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-red-600">{submitResult.error || 'An error occurred'}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default QuickDelivery;

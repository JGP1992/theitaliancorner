'use client';

import '../../../../globals.css';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Save, X, Search } from 'lucide-react';

interface Item {
  id: string;
  name: string;
  category: {
    id: string;
    name: string;
  };
  targetText?: string;
  targetNumber?: number;
  unit?: string;
}

interface StoreInventoryItem {
  id: string;
  item: Item;
  targetQuantity?: number;
  targetText?: string;
  unit?: string;
  isActive: boolean;
}

export default function StoreInventoryPage() {
  const params = useParams();
  const router = useRouter();
  // Dynamic segment is [slug], ensure we read the correct key
  const storeSlug = params.slug as string;

  const [inventory, setInventory] = useState<StoreInventoryItem[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [stores, setStores] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreInventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Form state for adding/editing items
  const [selectedItemId, setSelectedItemId] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [targetText, setTargetText] = useState('');
  const [unit, setUnit] = useState('');

  useEffect(() => {
  fetchInventory();
  fetchAvailableItems();
  fetchStores();
  }, [storeSlug]);

  const fetchInventory = async () => {
    try {
  const response = await fetch(`/api/stores/${storeSlug}/inventory`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setInventory(data.inventory);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableItems = async () => {
    try {
  const response = await fetch('/api/items', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAvailableItems(data);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStores(data.stores || []);
      }
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const handleAddItem = async () => {
    if (!selectedItemId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/stores/${storeSlug}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          itemId: selectedItemId,
          targetQuantity: targetQuantity ? parseFloat(targetQuantity) : null,
          targetText: targetText || null,
          unit: unit || null,
        }),
      });

      if (response.ok) {
        await fetchInventory();
        resetForm();
        setShowAddModal(false);
      }
    } catch (error) {
      console.error('Failed to add item:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/stores/${storeSlug}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          itemId: editingItem.item.id,
          targetQuantity: targetQuantity ? parseFloat(targetQuantity) : null,
          targetText: targetText || null,
          unit: unit || null,
        }),
      });

      if (response.ok) {
        await fetchInventory();
        resetForm();
        setEditingItem(null);
      }
    } catch (error) {
      console.error('Failed to update item:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this item from the store inventory?')) return;

    try {
      const response = await fetch(`/api/stores/${storeSlug}/inventory`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemId }),
      });

      if (response.ok) {
        await fetchInventory();
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const resetForm = () => {
    setSelectedItemId('');
    setTargetQuantity('');
    setTargetText('');
    setUnit('');
  };

  const startEditing = (item: StoreInventoryItem) => {
    setEditingItem(item);
    setSelectedItemId(item.item.id);
    setTargetQuantity(item.targetQuantity?.toString() || '');
    setTargetText(item.targetText || '');
    setUnit(item.unit || '');
  };

  const cancelEditing = () => {
    setEditingItem(null);
    resetForm();
  };

  // Filter items based on search and category
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.item.category.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.item.category.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter
  const categories = Array.from(new Set(inventory.map(item => item.item.category.name)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Store Inventory Management</h1>
              <p className="mt-2 text-gray-600">Configure what items this store should stock and their target quantities</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Store</label>
              <select
                value={storeSlug}
                onChange={(e) => router.push(`/admin/stores/${e.target.value}/inventory`)}
                className="block w-56 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Item
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-full"
              />
            </div>
          </div>
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventory.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.item.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {item.item.category.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.targetText || item.targetQuantity || 'Not set'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.unit || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => startEditing(item)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.item.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredInventory.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">No items configured for this store yet.</p>
            <p className="text-gray-500">Use the "Add Item" button to add items and targets.</p>
          </div>
        )}

        {/* Add Item Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Add Item to Store Inventory</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Item</label>
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Choose an item...</option>
                      {availableItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.category.name} - {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Quantity (Number)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={targetQuantity}
                      onChange={(e) => setTargetQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Text</label>
                    <input
                      type="text"
                      value={targetText}
                      onChange={(e) => setTargetText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 1/2 tub"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., kg, l, tubs"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddItem}
                    disabled={saving || !selectedItemId}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Adding...' : 'Add Item'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {editingItem && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Item: {editingItem.item.name}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Quantity (Number)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={targetQuantity}
                      onChange={(e) => setTargetQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Text</label>
                    <input
                      type="text"
                      value={targetText}
                      onChange={(e) => setTargetText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 1/2 tub"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., kg, l, tubs"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={cancelEditing}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateItem}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Updating...' : 'Update Item'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

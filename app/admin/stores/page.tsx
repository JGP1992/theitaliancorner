'use client';

import '../../globals.css';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, Package } from 'lucide-react';
import DeleteButton from '../delete-button';

interface Store {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export default function StoresManagementPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores');
      if (response.ok) {
        const data = await response.json();
        setStores(data.stores || []);
      }
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStore = async (storeSlug: string) => {
    console.log('🖱️ Delete button clicked for store:', storeSlug);
    alert(`Delete button clicked for store: ${storeSlug}`);

    try {
      const response = await fetch(`/api/stores/${storeSlug}`, {
        method: 'DELETE',
      });

      console.log('📡 API Response status:', response.status);

      if (response.ok) {
        console.log('✅ Store deleted successfully');
        alert('Store deleted successfully!');
        // Refresh the stores list
        fetchStores();
      } else {
        const error = await response.json();
        console.error('❌ API Error:', error);
        alert(`Delete failed: ${error.error || 'Unknown error'}`);
        throw new Error(error.error || 'Failed to delete store');
      }
    } catch (error) {
      console.error('❌ Error deleting store:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Store Management</h1>
          <p className="mt-2 text-gray-600">Manage store inventory and configurations</p>
        </div>

        {/* Stores Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <div key={store.id} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Package className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-medium text-gray-900">{store.name}</h3>
                    <p className="text-sm text-gray-500">Slug: {store.slug}</p>
                  </div>
                </div>
                <div className="mt-4 flex space-x-2">
                  <Link
                    href={`/admin/stores/${store.slug}/inventory`}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Inventory
                  </Link>
                  <DeleteButton
                    id={store.slug}
                    type="store"
                    name={store.name}
                    onDelete={handleDeleteStore}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {stores.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No stores found</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first store.</p>
          </div>
        )}
      </div>
    </div>
  );
}

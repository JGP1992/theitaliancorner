'use client';
import '../../globals.css';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QuickDelivery from '../../factory/quick-delivery';

type Store = { id: string; name: string; slug: string };
type Customer = { id: string; name: string; type: string };

export default function SetDeliveriesPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [storesRes, customersRes] = await Promise.all([
          fetch('/api/stores', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/customers', { credentials: 'include', cache: 'no-store' }),
        ]);
        if (!storesRes.ok) throw new Error(`Stores failed ${storesRes.status}`);
        if (!customersRes.ok) throw new Error(`Customers failed ${customersRes.status}`);
        const storesJson = await storesRes.json();
        const customersJson = await customersRes.json();
        setStores(Array.isArray(storesJson) ? storesJson : (storesJson?.stores ?? []));
        setCustomers(Array.isArray(customersJson) ? customersJson : (customersJson?.customers ?? []));
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-16 text-gray-600">Loading…</div>
        ) : error ? (
          <div className="text-center py-12">
            {(() => {
              const is401 = /401/.test(error || '');
              const is403 = /403/.test(error || '');
              if (is401) {
                return (
                  <div className="inline-flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-5">
                    <div className="text-red-700 font-medium">You need to sign in to use Set Deliveries</div>
                    <button
                      onClick={() => router.push('/login')}
                      className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Go to Login
                    </button>
                    <p className="text-xs text-red-600/80">If you just signed in, refresh this page.</p>
                  </div>
                );
              }
              if (is403) {
                return (
                  <div className="inline-flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-5">
                    <div className="text-amber-800 font-medium">You don’t have permission to set deliveries</div>
                    <p className="text-xs text-amber-700">Ask an admin to grant “deliveries:read” or “deliveries:create”, or sign in with an admin account.</p>
                  </div>
                );
              }
              return <div className="text-red-600">{error}</div>;
            })()}
          </div>
        ) : (
          <QuickDelivery customers={customers} stores={stores} />
        )}
      </div>
    </div>
  );
}

"use client";

import '../../globals.css';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ItemSelector from '../item-selector';

type Store = { id: string; name: string; slug: string };

type SelectedItem = { id: string; name: string; quantity: number; unit?: string };

export default function MasterStocktakePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeSlug, setStoreSlug] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSubmitter, setLastSubmitter] = useState<string | null>(null);

  useEffect(() => {
    const loadStores = async () => {
      try {
        const res = await fetch('/api/stores', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return;
        const raw = await res.json();
        const list: Store[] = Array.isArray(raw) ? raw : (raw?.stores ?? []);
        setStores(list);
        const factory = list.find((s) => s.slug === 'factory');
        setStoreSlug(factory?.slug || list[0]?.slug || '');
      } catch {}
    };
    loadStores();
  }, []);

  const canSubmit = useMemo(() => {
    if (!storeSlug) return false;
    if (!date) return false;
    const anyQty = selectedItems.some((i) => typeof i.quantity === 'number' && i.quantity > 0);
    return anyQty;
  }, [storeSlug, date, selectedItems]);

  const onSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const payload = {
        storeSlug,
        date: new Date(date).toISOString(),
        notes: notes?.trim() || undefined,
        isMaster: true,
        items: selectedItems
          .filter((i) => i.quantity > 0)
          .map((i) => ({ itemId: i.id, quantity: i.quantity })),
      };
      const res = await fetch('/api/stocktakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create stocktake');
      }
      const created = await res.json().catch(() => null);
      const name = created?.submittedBy ? `${created.submittedBy.firstName} ${created.submittedBy.lastName}` : null;
      setLastSubmitter(name);
      setMessage('Master stocktake recorded successfully.');
      setSelectedItems([]);
      setNotes('');
    } catch (e: any) {
      setMessage(e?.message || 'Failed to record master stocktake');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Master Stocktake</h1>
            <p className="text-gray-600 mt-1">A full inventory snapshot for the Factory that drives production and ordering.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/factory" className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Back to Factory</Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
              <input
                value={stores.find((s) => s.slug === storeSlug)?.name || 'Factory'}
                readOnly
                className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 text-gray-700"
              />
              <p className="text-xs text-gray-500 mt-1">Master stocktakes are recorded for the Factory.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Full factory count"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <ItemSelector
              selectedItems={selectedItems}
              onItemsChange={setSelectedItems as any}
              destinationName={stores.find((s) => s.slug === storeSlug)?.name || 'Factory'}
              destinationType="store"
              showPackaging={false}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-500">Master stocktake updates the system-wide inventory snapshot; no deliveries are created.</div>
            <button
              onClick={onSubmit}
              disabled={!canSubmit || isSubmitting}
              className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save Master Stocktake'}
            </button>
          </div>

          {message && (
            <div className={`mt-3 text-sm ${message.includes('success') ? 'text-green-700' : 'text-red-700'}`}>
              {message}
              {lastSubmitter && (
                <span className="text-gray-600"> — recorded by {lastSubmitter}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

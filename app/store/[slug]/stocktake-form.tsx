"use client";
import { useMemo, useState } from 'react';
import PhotoInput from '../../../components/PhotoInput';

type Category = {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    targetNumber: number | null;
    targetText: string | null;
    unit: string | null;
    firstDelivered?: Date;
    lastDelivered?: Date;
    totalDelivered?: number;
    deliveryCount?: number;
  }[];
};

export default function StocktakeForm({ storeSlug, categories }: { storeSlug: string; categories: Category[] }) {
  const [values, setValues] = useState<Record<string, { quantity?: number; note?: string }>>({});
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const itemsFlat = useMemo(() => categories.flatMap((c) => c.items), [categories]);

  function updateQuantity(itemId: string, q: string) {
    const num = q === '' ? undefined : Number(q);
    setValues((v) => ({ ...v, [itemId]: { ...(v[itemId] || {}), quantity: Number.isFinite(num as number) ? (num as number) : undefined } }));
  }

  async function onSubmit() {
    setSubmitting(true);
    setMessage(null);
    try {
      const payload = {
        storeSlug,
        date,
        photoUrl,
        notes: notes || undefined,
        items: itemsFlat.map((i) => ({ itemId: i.id, quantity: values[i.id]?.quantity, note: values[i.id]?.note })),
      };
      const res = await fetch('/api/stocktakes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to submit');
      setMessage('Submitted!');
      setValues({});
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error submitting';
      setMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-green-800 mb-2">📝 Stocktake Instructions</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• Count ALL items currently in your store</li>
          <li>• Include gelato tubs, cleaning supplies, packaging, and other inventory</li>
          <li>• Include leftover stock from previous deliveries</li>
          <li>• Include partial quantities (e.g., 0.5 for half-full tubs)</li>
          <li>• Do not count empty or damaged items</li>
          <li>• Take a photo of your store inventory for reference</li>
        </ul>
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-600">Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b font-medium">{cat.name}</div>
            <div className="divide-y">
              {cat.items.map((item) => {
                const v = values[item.id]?.quantity ?? '';
                return (
                  <div key={item.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.name}</div>
                      {(item.targetText || item.unit) && (
                        <div className="text-xs text-gray-500">
                          Target: {item.targetText || item.targetNumber} {item.unit || ''}
                        </div>
                      )}
                      {item.lastDelivered && (
                        <div className="text-xs text-blue-600">
                          Last delivered: {new Date(item.lastDelivered).toLocaleDateString()}
                          {item.totalDelivered && ` (Total: ${item.totalDelivered} tubs)`}
                          {item.deliveryCount && item.deliveryCount > 1 && ` • ${item.deliveryCount} deliveries`}
                        </div>
                      )}
                    </div>
                    <input
                      inputMode="decimal"
                      value={v}
                      onChange={(e) => updateQuantity(item.id, e.target.value)}
                      placeholder="Qty"
                      className="w-24 border rounded px-2 py-1 text-right"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-lg shadow-sm p-4">
        <PhotoInput
          value={photoUrl}
          onChange={setPhotoUrl}
          label="Store Inventory Photo"
          description="Take a clear photo of your store inventory showing current stock levels of all items."
          previewHeight="h-48"
        />
      </div>

      <div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          className="w-full border rounded px-3 py-2 min-h-24"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit nightly stocktake'}
        </button>
        {message && <div className="text-sm text-gray-600">{message}</div>}
      </div>
    </div>
  );
}

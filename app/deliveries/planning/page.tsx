'use client';

import '../../globals.css';
import { Suspense } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Minimal types based on existing APIs
type DeliveryPlan = {
  id: string;
  date: string;
  status: 'DRAFT' | 'CONFIRMED' | 'SENT';
  notes?: string;
  store?: { id: string; name: string; slug: string };
  customers: { customer: { id: string; name: string; type: string } }[];
  items: { id: string; quantity: number; note?: string; weightKg?: number; packaging?: { id: string; name: string; type: string; sizeValue: number | null; sizeUnit: string | null; variableWeight: boolean } | undefined; item: { id: string; name: string; unit?: string; category?: { name: string } | null } }[];
};

const statusColors: Record<DeliveryPlan['status'], string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  SENT: 'bg-green-100 text-green-800',
};

export default function DeliveriesPlanningPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">Loading…</div>}>
      <DeliveriesPlanningInner />
    </Suspense>
  );
}

function DeliveriesPlanningInner() {
  const search = useSearchParams();
  const [plans, setPlans] = useState<DeliveryPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(7);
  const [status, setStatus] = useState<'DRAFT' | 'CONFIRMED' | 'SENT' | ''>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'store' | 'customer'>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  const dates = useMemo(() => {
    const start = new Date(from + 'T00:00:00');
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [from, days]);

  useEffect(() => {
    // Initialize from query params (on first mount)
    const qFrom = search.get('from');
    const qDays = search.get('days');
    const qStatus = search.get('status');
    if (qFrom) setFrom(qFrom);
    if (qDays) setDays(Math.max(1, Math.min(30, parseInt(qDays, 10) || 7)));
    if (qStatus === 'DRAFT' || qStatus === 'CONFIRMED' || qStatus === 'SENT' || qStatus === '') setStatus(qStatus as any);
    // We don't include setters or search in deps to avoid reinit after user changes UI
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch for each day to keep server simple and reuse current API
        const dayResults: DeliveryPlan[] = [];
        for (const d of dates) {
          const url = `/api/delivery-plans?${status ? `status=${status}&` : ''}date=${d}`;
          const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
          if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
          const data = await res.json();
          dayResults.push(...data);
        }
        setPlans(dayResults);
      } catch (e: any) {
        setError(e?.message || 'Failed to load plans');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dates, status]);

  const grouped = useMemo(() => {
    const byDate: Record<string, DeliveryPlan[]> = {};
    for (const p of plans) {
      const key = p.date.slice(0, 10);
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(p);
    }
    return byDate;
  }, [plans]);

  // Helper: count variable-weight items missing weights per plan
  const missingWeightsForPlan = (p: DeliveryPlan) => {
    return p.items.filter(it => it.packaging?.variableWeight && (!it.weightKg || it.weightKg <= 0)).length;
  };

  const confirmPlan = async (planId: string) => {
    const res = await fetch(`/api/delivery-plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });
    if (res.ok) {
      setPlans(prev => prev.map(p => (p.id === planId ? { ...p, status: 'CONFIRMED' } : p)));
    } else {
      alert('Failed to confirm plan');
    }
  };

  const markSent = async (planId: string) => {
    const res = await fetch(`/api/delivery-plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'SENT' }),
    });
    if (res.ok) {
      setPlans(prev => prev.map(p => (p.id === planId ? { ...p, status: 'SENT' } : p)));
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Failed to mark as sent');
    }
  };

  const updateItemWeight = async (itemId: string, weight: number | null) => {
    try {
      setSaving(s => ({ ...s, [itemId]: 'saving' }));
      const res = await fetch(`/api/delivery-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ weightKg: weight }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to save weight');
      }
      // Update local state
      setPlans(prev => prev.map(p => ({
        ...p,
        items: p.items.map(it => (it.id === itemId ? { ...it, weightKg: weight ?? undefined } : it)),
      })));
      setSaving(s => ({ ...s, [itemId]: 'saved' }));
      setTimeout(() => setSaving(s => ({ ...s, [itemId]: 'idle' })), 1200);
    } catch (e) {
      console.error(e);
      setSaving(s => ({ ...s, [itemId]: 'error' }));
      setTimeout(() => setSaving(s => ({ ...s, [itemId]: 'idle' })), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Deliveries Planning</h1>
              <p className="text-gray-600 mt-1">Plan deliveries so production knows exactly what to make and when.</p>
            </div>
            <div className="flex gap-3">
              <Link href="/factory" className="px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200">Factory</Link>
              <Link href="/production/analytics" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Production Analytics</Link>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-white border rounded p-3">
              <div className="font-medium text-gray-900">Step 1</div>
              <div className="text-gray-600">Choose date range and filter by status.</div>
            </div>
            <div className="bg-white border rounded p-3">
              <div className="font-medium text-gray-900">Step 2</div>
              <div className="text-gray-600">Review each day’s destinations and quantities.</div>
            </div>
            <div className="bg-white border rounded p-3">
              <div className="font-medium text-gray-900">Step 3</div>
              <div className="text-gray-600">Confirm drafts so production can proceed.</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Days</label>
            <input type="number" min={1} max={30} value={days} onChange={e => setDays(Number(e.target.value) || 1)} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: '', label: 'All' },
                { key: 'DRAFT', label: 'Draft' },
                { key: 'CONFIRMED', label: 'Confirmed' },
                { key: 'SENT', label: 'Sent' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setStatus(s.key as any)}
                  className={`px-3 py-1.5 rounded text-sm border ${status === s.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'store', label: 'Stores' },
                { key: 'customer', label: 'Customers' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTypeFilter(t.key as any)}
                  className={`px-3 py-1.5 rounded text-sm border ${typeFilter === t.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end">
            <Link href="/factory/production-planning" className="w-full text-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Production Needs →</Link>
          </div>
        </div>
        <div className="mb-6">
          <Link href="/deliveries/set" className="text-sm text-blue-600 hover:text-blue-800">Need to create plans? Use Quick Delivery on the Set Deliveries page →</Link>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-600">Loading...</div>
        ) : error ? (
          <div className="text-center py-16 text-red-600">{error}</div>
        ) : (
          <div className="space-y-8">
            {dates.map(date => {
              const dayPlans = grouped[date] || [];
              const storeCount = dayPlans.filter(p => !!p.store).length;
              const customerCount = dayPlans.length - storeCount;
              const totalItems = dayPlans.reduce((s, p) => s + p.items.length, 0);
              // Count tubs: if packaging present, count only 5 L tubs; otherwise fall back to category-based quantity
              const gelatoTubs = dayPlans.reduce((s, p) => s + p.items
                .filter(i => i.item.category?.name === 'Gelato Flavors')
                .reduce((a, i) => {
                  if (i.packaging && i.packaging.sizeUnit === 'L' && i.packaging.sizeValue === 5) {
                    return a + i.quantity;
                  }
                  // If packaging is missing, we can't be sure; skip to avoid overcounting
                  return a;
                }, 0), 0);
              return (
                <div key={date} className="bg-white border rounded-lg">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <div className="font-semibold text-gray-900">{new Date(date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                    <div className="text-sm text-gray-600 flex gap-4">
                      <span>{dayPlans.length} plans</span>
                      <span>{storeCount} stores</span>
                      <span>{customerCount} customers</span>
                      <span>{gelatoTubs} tubs</span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {dayPlans.length === 0 ? (
                      <div className="px-4 py-6 text-gray-500">No plans.</div>
                    ) : (
                      dayPlans
                        .filter(p =>
                          typeFilter === 'all' ? true : typeFilter === 'store' ? !!p.store : p.customers.length > 0
                        )
                        .map(p => (
                        <div key={p.id} className="px-4 py-4">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {p.store?.name || p.customers.map(c => c.customer.name).join(', ') || 'Unknown'}
                              </div>
                              <div className="text-xs text-gray-500">{p.customers.length > 0 ? 'Customer delivery' : 'Store delivery'} • {p.items.length} items • {p.items.filter(i => i.item.category?.name === 'Gelato Flavors' && i.packaging && i.packaging.sizeUnit === 'L' && i.packaging.sizeValue === 5).reduce((a, i) => a + i.quantity, 0)} tubs</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50"
                              >
                                {expanded[p.id] ? 'Hide items' : 'View items'}
                              </button>
                              <span className={`px-2 py-1 rounded-full text-xs ${statusColors[p.status]}`}>{p.status}</span>
                              {/* Weights status for variable-weight lines */}
                              <span
                                className={`px-2 py-1 rounded-full text-[10px] border ${missingWeightsForPlan(p) === 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}
                                title={missingWeightsForPlan(p) === 0 ? 'All tray weights captured' : `${missingWeightsForPlan(p)} tray line(s) missing weight`}
                              >
                                {missingWeightsForPlan(p) === 0 ? 'weights OK' : `missing ${missingWeightsForPlan(p)}`}
                              </span>
                              {p.status === 'DRAFT' && (
                                <button onClick={() => confirmPlan(p.id)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Confirm</button>
                              )}
                              {p.status === 'CONFIRMED' && (
                                <button
                                  onClick={() => markSent(p.id)}
                                  disabled={missingWeightsForPlan(p) > 0}
                                  className={`px-3 py-1.5 text-xs rounded text-white ${missingWeightsForPlan(p) > 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                                  title={missingWeightsForPlan(p) > 0 ? 'Enter all tray weights before dispatch' : 'Dispatch this plan'}
                                >
                                  Ready to Dispatch
                                </button>
                              )}
                            </div>
                          </div>
                          {expanded[p.id] && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                              {p.items.map(it => (
                                <div key={it.id} className="flex justify-between items-center gap-2">
                                  <span className="truncate">
                                    {it.item.name}
                                    {it.packaging && (
                                      <span className="ml-2 text-xs text-gray-500">[{it.packaging.name}]</span>
                                    )}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {it.packaging?.variableWeight ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          step="0.01"
                                          min={0}
                                          defaultValue={it.weightKg ?? ''}
                                          onBlur={(e) => {
                                            const val = e.currentTarget.value.trim();
                                            if (val === '') {
                                              updateItemWeight(it.id, null);
                                              return;
                                            }
                                            const nNum = Number(val);
                                            if (!Number.isNaN(nNum) && nNum > 0) {
                                              updateItemWeight(it.id, nNum);
                                            } else {
                                              // Invalid value, revert display to previous
                                              e.currentTarget.value = it.weightKg?.toString() ?? '';
                                            }
                                          }}
                                          placeholder="weight kg"
                                          className="w-24 border rounded px-2 py-1 text-right"
                                        />
                                        <span className="text-xs text-gray-500">kg</span>
                                        <span className="text-xs text-gray-500 ml-1">× {it.quantity}</span>
                                        <span className="text-xs">
                                          {saving[it.id] === 'saving' && <span className="text-gray-400">saving…</span>}
                                          {saving[it.id] === 'saved' && <span className="text-green-600">saved</span>}
                                          {saving[it.id] === 'error' && <span className="text-red-600">error</span>}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="font-medium ml-2">{it.quantity}{it.item.unit ? ` ${it.item.unit}` : ''}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

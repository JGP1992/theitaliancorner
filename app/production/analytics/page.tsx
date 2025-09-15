'use client';

import '../../globals.css';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

export default function ProductionAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const res = await fetch(`/api/production-analytics?days=${days}`, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
        const j = await res.json();
        setData(j);
      } catch (e: any) {
        setError(e?.message || 'Failed to load analytics');
      }
    };
    load();
  }, [days]);

  const topFlavors = useMemo(() => {
    if (!data?.gelatoTotals) return [];
    return Object.entries(data.gelatoTotals).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10);
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Production Analytics</h1>
            <p className="text-gray-600">Plan production per store, with lead time awareness.</p>
          </div>
          <Link href="/factory" className="text-blue-600 hover:text-blue-800">← Factory</Link>
        </div>

        <div className="bg-white border rounded-lg p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Days</label>
            <input type="number" min={1} max={30} value={days} onChange={e => setDays(Number(e.target.value) || 7)} className="w-full border rounded px-3 py-2" />
          </div>
          {data?.range && (
            <div className="md:col-span-3 text-sm text-gray-600 flex items-end">Range: {data.range.start} → {data.range.end}</div>
          )}
        </div>

        {error ? (
          <div className="text-center py-16 text-red-600">{error}</div>
        ) : !data ? (
          <div className="text-center py-16 text-gray-600">Loading...</div>
        ) : (
          <div className="space-y-8">
            {/* Per store overview */}
            <div className="bg-white border rounded-lg">
              <div className="px-4 py-3 border-b font-semibold">Per Store Overview</div>
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {data.perStore?.map((s: any) => (
                  <div key={s.storeId} className="border rounded p-4">
                    <div className="font-medium text-gray-900 mb-2">{s.storeName}</div>
                    <div className="text-sm text-gray-600 mb-2">Plans: {s.totals.totalPlans} • Items: {s.totals.totalItems} • Gelato tubs: {s.totals.gelatoTubs}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(s.days).map(([d, v]: any) => (
                        <div key={d} className="flex justify-between">
                          <span>{new Date(d).toLocaleDateString()}</span>
                          <span className="ml-2 font-medium">{v.gelatoTubs} tubs</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top flavors */}
            <div className="bg-white border rounded-lg">
              <div className="px-4 py-3 border-b font-semibold">Top Flavors (demand)</div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {topFlavors.map(([name, qty]: any) => (
                  <div key={name} className="border rounded p-3 flex items-center justify-between">
                    <span className="truncate pr-2">{name}</span>
                    <span className="font-semibold text-purple-700">{qty}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lead time risk */}
            <div className="bg-white border rounded-lg">
              <div className="px-4 py-3 border-b font-semibold">Lead Time Risk</div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.leadTimeRisk?.map((r: any) => (
                  <div key={r.flavor} className={`border rounded p-3 ${r.risk==='HIGH' ? 'border-red-300 bg-red-50' : r.risk==='MEDIUM' ? 'border-yellow-300 bg-yellow-50' : 'border-green-200 bg-green-50'}`}>
                    <div className="font-medium text-gray-900">{r.flavor}</div>
                    <div className="text-sm text-gray-600">Upcoming tubs: {r.qty}</div>
                    <div className="text-xs mt-1">Risk: {r.risk}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

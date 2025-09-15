"use client";

import '../globals.css';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';

// Lightweight types
type Plan = {
  id: string;
  date: string; // ISO
  status: 'DRAFT' | 'CONFIRMED' | 'SENT';
  store?: { id: string; name: string; slug: string };
  customers: { customer: { id: string; name: string } }[];
  items: { id: string; quantity: number; item: { id: string; name: string; category?: { name: string } | null }; packaging?: { sizeUnit: string | null; sizeValue: number | null } }[];
};

function getMonthBounds(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0); // last day of month
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(start), to: fmt(end) };
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // make Monday=0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [status, setStatus] = useState<'all' | 'DRAFT' | 'CONFIRMED' | 'SENT'>('all');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [view, setView] = useState<'month' | 'week'>('month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(() => getMonthBounds(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const url = new URL(`/api/delivery-plans`, window.location.origin);
        url.searchParams.set('from', from);
        url.searchParams.set('to', to);
        if (status !== 'all') url.searchParams.set('status', status);
        const res = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const data = (await res.json()) as Plan[];
        setPlans(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [from, to, status]);

  const byDay = useMemo(() => {
    const map: Record<string, Plan[]> = {};
    for (const p of plans) {
      const key = p.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [plans]);

  // Build grid days based on view mode
  const gridDays = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(cursor);
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) days.push(addDays(start, i));
      return days;
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const gridStart = startOfWeek(first);
    const gridEnd = addDays(startOfWeek(addDays(last, 6)), 6); // end of week of last day
    const days: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) days.push(new Date(d));
    return days;
  }, [cursor, view]);

  const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 border rounded" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              ← Prev
            </button>
            <div className="min-w-[160px] text-center font-medium">{monthLabel}</div>
            <button className="px-3 py-2 border rounded" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              Next →
            </button>
            <button className="px-3 py-2 border rounded" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
              Today
            </button>
            <div className="ml-2">
              <label className="text-sm text-gray-600 mr-1">View</label>
              <select value={view} onChange={(e) => setView(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
                <option value="month">Month</option>
                <option value="week">Week</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-gray-600">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="border rounded px-3 py-2">
            <option value="all">All</option>
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="SENT">Sent</option>
          </select>
          <Link href={`/deliveries/planning`} className="ml-auto px-3 py-2 border rounded bg-purple-600 text-white">Deliveries Planning →</Link>
        </div>

        {error && <div className="text-red-600 mb-3">{error}</div>}
        {loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="text-xs font-medium text-gray-600 px-2">{d}</div>
            ))}
            {gridDays.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const isOtherMonth = d.getMonth() !== cursor.getMonth();
              const dayPlans = byDay[key] || [];
              const gelatoTubs = dayPlans.reduce((sum, p) => sum + p.items
                .filter(i => i.item.category?.name === 'Gelato Flavors' && i.packaging?.sizeUnit === 'L' && i.packaging?.sizeValue === 5)
                .reduce((s, i) => s + i.quantity, 0), 0);
              const storeCount = dayPlans.filter(p => !!p.store).length;
              const customerCount = dayPlans.filter(p => !p.store && (p.customers?.length || 0) > 0).length;
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={key} className={`border rounded p-2 min-h-[120px] bg-white ${isOtherMonth ? 'opacity-50' : ''} ${isToday ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <div className={`text-sm font-medium ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>{d.getDate()}</div>
                      {isToday && (
                        <span className="text-[10px] px-1 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Today</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {gelatoTubs > 0 && (
                        <div className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800" title="Total 5L tubs for gelato deliveries">{gelatoTubs} tubs</div>
                      )}
                      {(storeCount > 0 || customerCount > 0) && (
                        <div className="flex items-center gap-1">
                          {storeCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700" title="Store deliveries on this day">Stores {storeCount}</span>
                          )}
                          {customerCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700" title="Customer deliveries on this day">Customers {customerCount}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {dayPlans.slice(0, 3).map((p) => (
                      <Link key={p.id} href={`/deliveries/planning?from=${key}&days=1&status=${status === 'all' ? '' : status}`} className="block text-xs truncate">
                        <span className={`inline-block w-2 h-2 rounded-full mr-1 ${p.status === 'SENT' ? 'bg-green-500' : p.status === 'CONFIRMED' ? 'bg-blue-500' : 'bg-yellow-500'}`}></span>
                        {p.store?.name || (p.customers?.map(c => c.customer.name).join(', ') || '') || 'Delivery'}
                      </Link>
                    ))}
                    {dayPlans.length > 3 && (
                      <Link href={`/deliveries/planning?from=${key}&days=1&status=${status === 'all' ? '' : status}`} className="text-[10px] text-blue-600">+{dayPlans.length - 3} more</Link>
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

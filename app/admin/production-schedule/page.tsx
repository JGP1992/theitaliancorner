'use client';

import '../../globals.css';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Task = {
  id: string;
  date: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  quantity: number;
  unit: string;
  notes?: string | null;
  item: { id: string; name: string; category?: { name: string } | null };
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
};

type Item = { id: string; name: string; category?: { name: string } | null };

export default function ProductionSchedulePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [itemId, setItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('tubs');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, tasksRes] = await Promise.all([
        fetch('/api/items', { credentials: 'include', cache: 'no-store' }),
        fetch(`/api/production-tasks?start=${date}&end=${date}`, { credentials: 'include', cache: 'no-store' }),
      ]);
      if (!itemsRes.ok) throw new Error('Failed to load items');
      const rawItems = await itemsRes.json();
      const mappedItems: Item[] = Array.isArray(rawItems)
        ? rawItems.map((it: any) => ({ id: String(it.id), name: String(it.name), category: it.category || null }))
        : [];
      setItems(mappedItems);
      const tdata = await tasksRes.json();
      setTasks(tdata.tasks || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const createTask = async () => {
    if (!date || !itemId || !quantity) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/production-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date, itemId, quantity: parseFloat(quantity), unit, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create task');
      setTasks((prev) => [...prev, data.task]);
      setItemId('');
      setQuantity('');
      setNotes('');
    } catch (e: any) {
      setError(e?.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (id: string, patch: any) => {
    try {
      const res = await fetch(`/api/production-tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Update failed');
      setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
    } catch (e) {
      console.error(e);
    }
  };

  const todaysTasks = useMemo(() => tasks.sort((a, b) => a.item.name.localeCompare(b.item.name)), [tasks]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Schedule</h1>
            <p className="text-gray-600">Plan what the Factory should make on specific days.</p>
          </div>
          <Link href="/factory" className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Back to Factory</Link>
        </div>

        <div className="bg-white rounded shadow-sm border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Flavor/Item</label>
              <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full border rounded px-3 py-2">
                <option value="">Select an item…</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>{it.category?.name ? `${it.category.name} — ` : ''}{it.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <input type="number" min="0" step={itemId ? 1 : 'any'} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit</label>
              <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="e.g., Sorbet needs extra freeze time" />
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={createTask} disabled={saving || !itemId || !quantity} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Task'}</button>
          </div>
          {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="bg-white rounded shadow-sm border">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold">Tasks for {new Date(date).toLocaleDateString()}</h2>
          </div>
          <div className="divide-y">
            {loading ? (
              <div className="p-4 text-gray-600">Loading…</div>
            ) : todaysTasks.length === 0 ? (
              <div className="p-4 text-gray-600">No tasks scheduled.</div>
            ) : (
              todaysTasks.map((t) => (
                <div key={t.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.item.name} <span className="text-gray-500">({t.quantity} {t.unit})</span></div>
                    <div className="text-sm text-gray-600">Status: {t.status.toLowerCase()} {t.assignedTo ? `• Assigned to ${t.assignedTo.firstName} ${t.assignedTo.lastName}` : ''}</div>
                    {t.notes && <div className="text-sm text-gray-500">Notes: {t.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateTask(t.id, { start: true })} className="px-3 py-1 text-sm bg-amber-500 text-white rounded">Start</button>
                    <button onClick={() => updateTask(t.id, { complete: true })} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Done</button>
                    <button onClick={() => updateTask(t.id, { cancel: true })} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Cancel</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

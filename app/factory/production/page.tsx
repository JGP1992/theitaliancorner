'use client';

import '../../globals.css';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Task = {
  id: string;
  date: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  quantity: number;
  unit: string;
  notes?: string | null;
  item: { id: string; name: string; category?: { name: string } | null };
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
};

export default function FactoryProductionTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/production-tasks?start=${today}&end=${today}`, { credentials: 'include', cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load');
        setTasks(data.tasks || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [today]);

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

  const todays = useMemo(() => tasks.filter((t) => t.status !== 'CANCELLED').sort((a, b) => a.item.name.localeCompare(b.item.name)), [tasks]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Today’s Production</h1>
            <p className="text-gray-600">Tasks scheduled by Admin. Mark them as started/done.</p>
          </div>
          <Link href="/factory" className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Back to Factory</Link>
        </div>

        <div className="bg-white rounded shadow-sm border">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold">{new Date(today).toLocaleDateString()}</h2>
          </div>
          {loading ? (
            <div className="p-4 text-gray-600">Loading…</div>
          ) : error ? (
            <div className="p-4 text-red-700">{error}</div>
          ) : todays.length === 0 ? (
            <div className="p-4 text-gray-600">No tasks for today.</div>
          ) : (
            <div className="divide-y">
              {todays.map((t) => (
                <div key={t.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.item.name} <span className="text-gray-500">({t.quantity} {t.unit})</span></div>
                    <div className="text-sm text-gray-600">Status: {t.status.toLowerCase()} {t.assignedTo ? `• ${t.assignedTo.firstName} ${t.assignedTo.lastName}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateTask(t.id, { start: true })} className="px-3 py-1 text-sm bg-amber-500 text-white rounded">Start</button>
                    <button onClick={() => updateTask(t.id, { complete: true })} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Done</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

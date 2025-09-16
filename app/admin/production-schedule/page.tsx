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
  totalWeightKg?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  packagingOption?: { id: string; name: string; sizeValue?: number | null; sizeUnit?: string | null; type?: string | null } | null;
};

type Item = { id: string; name: string; category?: { name: string } | null };
type PackagingOption = {
  id: string;
  name: string;
  type: string;
  sizeValue: number | null;
  sizeUnit: string | null;
  variableWeight: boolean;
  allowStores: boolean;
  allowCustomers: boolean;
  isDefault?: boolean;
  isDefaultForStores?: boolean;
  isDefaultForCustomers?: boolean;
};

export default function ProductionSchedulePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [itemId, setItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('tubs');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | Task['status']>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'assignee'>('name');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  // Default to Stores as requested
  const [audience, setAudience] = useState<'store' | 'customer'>('store');
  const [packagingOptions, setPackagingOptions] = useState<PackagingOption[]>([]);
  const [packagingId, setPackagingId] = useState<string>('');

  function StatusBadge({ status }: { status: Task['status'] }) {
    const map: Record<Task['status'], { label: string; cls: string }> = {
      SCHEDULED: { label: 'Scheduled', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
      IN_PROGRESS: { label: 'In progress', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
      DONE: { label: 'Done', cls: 'bg-green-50 text-green-700 border-green-200' },
      CANCELLED: { label: 'Cancelled', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    };
    const s = map[status];
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${s.cls}`}>{s.label}</span>;
  }
  function Spinner({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
    return (
      <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke={color} strokeWidth="4" />
        <path className="opacity-75" fill={color} d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    );
  }

  // Map a packaging option to a production unit string accepted by the API
  function unitFromPackaging(p?: PackagingOption): 'tubs' | 'trays' | 'units' | 'kg' | 'l' {
    if (!p) return 'units';
    const n = (p.name || '').toLowerCase();
    const t = (p.type || '').toLowerCase();
    if (p.variableWeight || n.includes('tray') || t.includes('tray')) return 'trays';
    if (n.includes('tub') || t.includes('tub')) return 'tubs';
    if (n.includes('cup') || t.includes('cup')) return 'units';
    // Default fallbacks: use sizeUnit if provided
    if ((p.sizeUnit || '').toLowerCase() === 'l') return 'l';
    if ((p.sizeUnit || '').toLowerCase() === 'kg') return 'kg';
    return 'units';
  }

  // Format a packaging label with size if available (avoid duplication if already in name)
  function formatPackagingLabel(p?: PackagingOption | null): string {
    if (!p) return '';
    const name = p.name?.trim() || '';
    const v = p.sizeValue;
    const u = (p.sizeUnit || '').trim();
    if (v == null || !u) return name;
    const sizeStr = `${v} ${u}`;
    if (name.toLowerCase().includes(sizeStr.toLowerCase())) return name;
    return `${name} (${sizeStr})`;
  }

  function formatQtyUnit(q: number, u: string) {
    const isOne = Math.abs(q - 1) < 1e-9;
    const sym = u.toLowerCase();
    if (sym === 'kg' || sym === 'l' || sym === 'ml' || sym === 'g') return `${q} ${sym}`;
    if (sym.endsWith('s')) {
      return `${q} ${isOne ? sym.slice(0, -1) : sym}`;
    }
    return `${q} ${sym}`;
  }

  // Extract packaging label from notes (we saved as "Packaging: <name>")
  function packagingFromNotes(notes?: string | null): string | null {
    if (!notes) return null;
    const m = notes.match(/Packaging:\s*([^|\n\r]+)/i);
    return m ? m[1].trim() : null;
  }

  // Prefer packagingOption relation; fallback to notes-based label
  function packagingFromTask(t: Task): string | null {
    const p = t.packagingOption;
    if (p && p.name) {
      const v = p.sizeValue;
      const u = (p.sizeUnit || '').toLowerCase();
      if (v != null && u) {
        const sizeStr = `${v} ${u}`;
        if (p.name.toLowerCase().includes(sizeStr.toLowerCase())) return p.name;
        return `${p.name} (${sizeStr})`;
      }
      return p.name;
    }
    return packagingFromNotes(t.notes);
  }

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

  // Fetch packaging options when item or audience changes
  useEffect(() => {
    const loadPackaging = async () => {
      if (!itemId) {
        setPackagingOptions([]);
        setPackagingId('');
        return;
      }
      try {
        const res = await fetch(`/api/packaging-options?audience=${audience}&itemId=${itemId}`, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) {
          setPackagingOptions([]);
          setPackagingId('');
          return;
        }
        const opts: PackagingOption[] = await res.json();
        setPackagingOptions(opts);
        // Pick default: audience-specific default, else global default, else first matching by name
        const preferred = opts.find((o) => audience === 'store' ? o.isDefaultForStores : o.isDefaultForCustomers)
          || opts.find((o) => o.isDefault)
          || opts[0];
        setPackagingId(preferred ? preferred.id : '');
        if (preferred) setUnit(unitFromPackaging(preferred));
      } catch {
        setPackagingOptions([]);
        setPackagingId('');
      }
    };
    loadPackaging();
  }, [itemId, audience]);

  const createTask = async () => {
    if (!date || !itemId || !quantity) return;
    setSaving(true);
    setError(null);
    try {
      // Compose notes to include packaging label (with size) for clarity
      const selectedPackaging = packagingOptions.find((p) => p.id === packagingId);
      const packagingLabel = selectedPackaging ? `Packaging: ${formatPackagingLabel(selectedPackaging)}` : '';
      const finalNotes = [notes.trim(), packagingLabel].filter(Boolean).join(' | ');
      const finalUnit = unitFromPackaging(selectedPackaging);
      const res = await fetch('/api/production-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date,
          itemId,
          quantity: parseFloat(quantity),
          unit: finalUnit,
          notes: finalNotes || undefined,
          packagingOptionId: packagingId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create task');
      setTasks((prev) => [...prev, data.task]);
      setItemId('');
      setQuantity('');
      setNotes('');
      setPackagingId('');
    } catch (e: any) {
      setError(e?.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  type TaskPatch = Partial<{ start: boolean; complete: boolean; cancel: boolean; notes: string; totalWeightKg: number }>;
  const updateTask = async (id: string, patch: TaskPatch) => {
    try {
      setUpdating((u) => ({ ...u, [id]: true }));
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
    } finally {
      setUpdating((u) => ({ ...u, [id]: false }));
    }
  };

  const assignees = useMemo(() => {
    const map: Record<string, string> = {};
    tasks.forEach((t) => { if (t.assignedTo) map[t.assignedTo.id] = `${t.assignedTo.firstName} ${t.assignedTo.lastName}`; });
    return map;
  }, [tasks]);
  const todaysTasks = useMemo(() => {
    let list = [...tasks];
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter);
    if (assigneeFilter !== 'all') list = list.filter((t) => t.assignedTo?.id === assigneeFilter);
    if (sortBy === 'name') list = list.sort((a, b) => a.item.name.localeCompare(b.item.name));
    else if (sortBy === 'status') list = list.sort((a, b) => a.status.localeCompare(b.status));
    else if (sortBy === 'assignee') list = list.sort((a, b) => (a.assignedTo?.firstName || '').localeCompare(b.assignedTo?.firstName || ''));
    return list;
  }, [tasks, statusFilter, assigneeFilter, sortBy]);

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
              <label className="block text-sm font-medium mb-1">Audience</label>
              <select value={audience} onChange={(e) => setAudience(e.target.value as 'store' | 'customer')} className="w-full border rounded px-3 py-2">
                <option value="customer">Restaurants/Customers</option>
                <option value="store">Shops/Stores</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end mt-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Packaging</label>
              <select
                value={packagingId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPackagingId(id);
                  const selected = packagingOptions.find((p) => p.id === id);
                  setUnit(unitFromPackaging(selected));
                }}
                className="w-full border rounded px-3 py-2"
                disabled={!itemId}
              >
                {!itemId && <option value="">Select an item first…</option>}
                {itemId && packagingOptions.length === 0 && <option value="">No packaging for this audience</option>}
                {packagingOptions.map((p) => (
                  <option key={p.id} value={p.id}>{formatPackagingLabel(p)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Derived unit</label>
              <input value={unit} readOnly className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-700" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="e.g., Sorbet needs extra freeze time" />
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={createTask} disabled={saving || !itemId || !quantity || (!!itemId && packagingOptions.length > 0 && !packagingId)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Task'}</button>
          </div>
          {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="bg-white rounded shadow-sm border">
          <div className="px-4 py-3 border-b">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold">Tasks for {new Date(date).toLocaleDateString()}</h2>
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="border rounded px-2 py-1 text-xs">
                  <option value="all">All statuses</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="DONE">Done</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="border rounded px-2 py-1 text-xs">
                  <option value="all">All assignees</option>
                  {Object.entries(assignees).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="border rounded px-2 py-1 text-xs">
                  <option value="name">Sort: Name</option>
                  <option value="status">Sort: Status</option>
                  <option value="assignee">Sort: Assignee</option>
                </select>
                <button
                  onClick={async () => {
                    const toComplete = todaysTasks.filter((t) => !t.unit.toLowerCase().includes('tray') && t.status !== 'DONE' && t.status !== 'CANCELLED' && selected[t.id]);
                    for (const t of toComplete) await updateTask(t.id, { complete: true });
                    setSelected({});
                  }}
                  className="px-2 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-50"
                  disabled={!todaysTasks.some((t) => selected[t.id])}
                >Complete Selected</button>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="p-4 text-gray-600">Loading…</div>
          ) : todaysTasks.length === 0 ? (
            <div className="p-4 text-gray-600">No tasks scheduled.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-700 border-b bg-gray-50">
                    <th className="px-4 py-2 w-8">Sel</th>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Packaging</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Assignee</th>
                    <th className="px-4 py-2">Started / Completed</th>
                    <th className="px-4 py-2">Notes</th>
                    <th className="px-4 py-2">Weight (kg)</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {todaysTasks.map((t) => (
                    <tr key={t.id} className="align-top">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={!!selected[t.id]}
                          onChange={(e) => setSelected((s) => ({ ...s, [t.id]: e.target.checked }))}
                          aria-label={`Select ${t.item.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.item.name}</div>
                        <div className="text-gray-500">{formatQtyUnit(t.quantity, t.unit)}</div>
                      </td>
                      <td className="px-4 py-3">
                        {packagingFromTask(t) ? (
                          <span className="text-gray-800">{packagingFromTask(t) as string}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-800">{t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : 'Unassigned'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {t.startedAt && (
                          <div>Started: {new Date(t.startedAt).toLocaleString()} {t.assignedTo ? `by ${t.assignedTo.firstName}` : ''}</div>
                        )}
                        {t.completedAt && (
                          <div className="mt-0.5">Completed: {new Date(t.completedAt).toLocaleString()} {t.assignedTo ? `by ${t.assignedTo.firstName}` : ''}</div>
                        )}
                        {!t.startedAt && t.status === 'SCHEDULED' && <div>Not started</div>}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {t.notes ? <div className="text-gray-700 truncate" title={t.notes}>{t.notes}</div> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {t.unit.toLowerCase().includes('tray') && (t.status === 'SCHEDULED' || t.status === 'IN_PROGRESS') ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={weights[t.id] ?? ''}
                              onChange={(e) => setWeights((w) => ({ ...w, [t.id]: e.target.value }))}
                              placeholder="e.g., 12.4"
                              inputMode="decimal"
                              className="border rounded px-2 py-1 text-xs w-24"
                            />
                            {typeof t.totalWeightKg === 'number' && (
                              <span className="text-xs text-gray-500">Saved: {t.totalWeightKg} kg</span>
                            )}
                          </div>
                        ) : (
                          typeof t.totalWeightKg === 'number' ? <span className="text-gray-700">{t.totalWeightKg} kg</span> : <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {t.status === 'SCHEDULED' && (
                            <button
                              onClick={() => updateTask(t.id, { start: true })}
                              disabled={!!updating[t.id]}
                              className={`px-3 py-1 text-sm rounded text-white inline-flex items-center gap-2 ${updating[t.id] ? 'bg-amber-300' : 'bg-amber-500 hover:bg-amber-600'}`}
                            >{updating[t.id] && <Spinner color="#78350f" />}<span>{updating[t.id] ? 'Starting…' : 'Start'}</span></button>
                          )}
                          {t.status !== 'DONE' && t.status !== 'CANCELLED' && (
                            <button
                              onClick={() => {
                                const patch: TaskPatch = { complete: true };
                                if (t.unit.toLowerCase().includes('tray')) {
                                  const raw = weights[t.id]?.trim();
                                  const w = raw ? parseFloat(raw) : undefined;
                                  if (w != null && Number.isFinite(w)) patch.totalWeightKg = w;
                                }
                                updateTask(t.id, patch);
                              }}
                              disabled={!!updating[t.id] || (t.unit.toLowerCase().includes('tray') && !(Number.isFinite(parseFloat(weights[t.id] ?? '')) && parseFloat(weights[t.id] ?? '') > 0))}
                              className={`px-3 py-1 text-sm rounded text-white inline-flex items-center gap-2 ${updating[t.id] ? 'bg-green-300' : 'bg-green-600 hover:bg-green-700'}`}
                            >{updating[t.id] && <Spinner color="#064e3b" />}<span>{updating[t.id] ? 'Finishing…' : 'Done'}</span></button>
                          )}
                          {t.status !== 'DONE' && t.status !== 'CANCELLED' && (
                            <button
                              onClick={() => updateTask(t.id, { cancel: true })}
                              disabled={!!updating[t.id]}
                              className={`px-3 py-1 text-sm rounded text-white ${updating[t.id] ? 'bg-red-300' : 'bg-red-600 hover:bg-red-700'}`}
                            >{updating[t.id] ? 'Cancelling…' : 'Cancel'}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

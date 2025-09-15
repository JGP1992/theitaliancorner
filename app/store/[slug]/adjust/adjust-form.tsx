'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Category = {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    unit: string | null;
  }[];
};

export default function AdjustStockForm({ storeSlug, categories }: { storeSlug: string; categories: Category[] }) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activePress, setActivePress] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const itemsFlat = useMemo(() => categories.flatMap((c) => c.items), [categories]);

  function setDelta(itemId: string, delta: number) {
    setValues((v) => ({ ...v, [itemId]: (v[itemId] ?? 0) + delta }));
  }

  function setExact(itemId: string, val: string) {
    const num = val === '' ? 0 : Number(val);
    setValues((v) => ({ ...v, [itemId]: Number.isFinite(num) ? num : 0 }));
  }

  // Long-press +/- support
  const pressTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function startPress(key: string, itemId: string, delta: number) {
    if (activePress) clearPress(activePress);
    setActivePress(key);
    setDelta(itemId, delta);
    const tick = () => {
      setDelta(itemId, delta);
      pressTimers.current[key] = setTimeout(tick, 120);
    };
    pressTimers.current[key] = setTimeout(tick, 500);
  }
  function clearPress(key?: string) {
    const k = key || activePress;
    if (!k) return;
    const t = pressTimers.current[k];
    if (t) clearTimeout(t);
    delete pressTimers.current[k];
    setActivePress(null);
  }

  // Collapsed state persistence per store
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`adjustCollapsed:${storeSlug}`);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {}
  }, [storeSlug]);
  useEffect(() => {
    try {
      localStorage.setItem(`adjustCollapsed:${storeSlug}`, JSON.stringify(collapsed));
    } catch {}
  }, [collapsed, storeSlug]);

  // Draft key per store/date
  const draftKey = `adjustDraft:${storeSlug}:${date}`;

  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setValues(parsed.values || {});
          setNotes(parsed.notes || '');
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Save draft (throttled)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function queueSaveDraft() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ values, notes }));
        setDraftSavedAt(Date.now());
      } catch {}
    }, 400);
  }
  useEffect(() => { queueSaveDraft(); }, [values]);
  useEffect(() => { queueSaveDraft(); }, [notes]);

  const filteredCategories = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => ({ ...c, items: c.items.filter((i) => i.name.toLowerCase().includes(q)) }))
      .filter((c) => c.items.length > 0);
  }, [categories, filter]);

  function focusNextEmpty() {
    const allIds = categories.flatMap((c) => c.items.map((i) => i.id));
    const nextId = allIds.find((id) => !values[id] || values[id] === 0);
    if (nextId) {
      inputRefs.current[nextId]?.focus();
    }
  }

  async function onSubmit() {
    setSubmitting(true);
    setMessage(null);
    try {
      const items = itemsFlat
        .map((i) => ({ itemId: i.id, quantity: values[i.id] ?? 0 }))
        .filter((i) => (i.quantity ?? 0) !== 0);

      if (items.length === 0) {
        setMessage('Enter at least one adjustment');
        setSubmitting(false);
        return;
      }

      const payload = {
        storeSlug,
        date,
        notes: notes ? `Adjustment: ${notes}` : 'Adjustment',
        items,
      };
      const res = await fetch('/api/stocktakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Submit failed (${res.status}): ${t}`);
      }
      setMessage('Adjustment recorded');
      setValues({});
      setNotes('');
      try { localStorage.removeItem(draftKey); } catch {}
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error submitting';
      setMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const nonZeroCount = Object.values(values).filter((v) => (v ?? 0) !== 0).length;

  return (
    <div className="space-y-6">
      {/* small draft saved indicator */}
      <div className="text-xs text-gray-500">{draftSavedAt ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}` : ' '}</div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Quick stock adjustment</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Use + to add stock received; use − to remove damaged or used stock</li>
          <li>• Enter negative values to remove, positive to add</li>
          <li>• Adjustments are logged like a stocktake entry for traceability</li>
        </ul>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-3 text-base min-h-[48px]" />
        </div>
        <div className="flex-1">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search items…"
            className="w-full border rounded px-3 py-3 text-base min-h-[48px]"
          />
        </div>
        <div>
          <button onClick={focusNextEmpty} className="px-4 py-3 border rounded text-base min-h-[48px]">Next empty</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={() => setCollapsed((s) => ({ ...s, [cat.id]: !s[cat.id] }))}
              className="w-full px-4 py-3 border-b font-medium text-lg flex items-center justify-between hover:bg-gray-50"
            >
              <span>{cat.name}</span>
              <span className="text-sm text-gray-500">{cat.items.length} items</span>
            </button>
            {!collapsed[cat.id] && (
              <div className="divide-y">
                {cat.items.map((item) => {
                  const v = values[item.id] ?? 0;
                  const keyMinus = `${item.id}:-1`;
                  const keyPlus = `${item.id}:+1`;
                  return (
                    <div key={item.id} className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-base truncate">{item.name}</div>
                        {item.unit && (
                          <div className="text-sm text-gray-500">Unit: {item.unit}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onMouseDown={() => startPress(keyMinus, item.id, -1)}
                          onTouchStart={() => startPress(keyMinus, item.id, -1)}
                          onMouseUp={() => clearPress()}
                          onMouseLeave={() => clearPress()}
                          onTouchEnd={() => clearPress()}
                          className="w-12 h-12 rounded border text-xl hover:bg-gray-50"
                        >
                          −
                        </button>
                        <input
                          ref={(el) => {
                            inputRefs.current[item.id] = el;
                          }}
                          inputMode="decimal"
                          step={0.5}
                          value={v === 0 ? '' : String(v)}
                          onChange={(e) => setExact(item.id, e.target.value)}
                          className="w-24 border rounded px-3 py-3 text-right text-lg min-h-[48px]"
                          placeholder="Qty"
                        />
                        <button
                          onMouseDown={() => startPress(keyPlus, item.id, +1)}
                          onTouchStart={() => startPress(keyPlus, item.id, +1)}
                          onMouseUp={() => clearPress()}
                          onMouseLeave={() => clearPress()}
                          onTouchEnd={() => clearPress()}
                          className="w-12 h-12 rounded border text-xl hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button onClick={() => setExact(item.id, '0')} className="px-2 py-1 text-xs border rounded">0</button>
                        <button onClick={() => setExact(item.id, '-1')} className="px-2 py-1 text-xs border rounded">-1</button>
                        <button onClick={() => setExact(item.id, '1')} className="px-2 py-1 text-xs border rounded">+1</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full border rounded px-3 py-3 min-h-24 text-base"
        />
      </div>

      <div className="sticky bottom-4 flex items-center gap-3 bg-white/80 backdrop-blur p-2 rounded-lg border shadow-sm w-fit">
        <button onClick={onSubmit} disabled={submitting} className="bg-black text-white rounded px-4 py-3 disabled:opacity-50 text-base min-h-[48px]">
          {submitting ? 'Saving…' : `Save adjustment${nonZeroCount ? ` (${nonZeroCount})` : ''}`}
        </button>
        {message && <div className="text-sm text-gray-600">{message}</div>}
      </div>
    </div>
  );
}

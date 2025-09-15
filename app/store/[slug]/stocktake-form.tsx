"use client";
import { useMemo, useRef, useState, useEffect } from 'react';
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
  const [activePress, setActivePress] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [gelatoQuickMode, setGelatoQuickMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem(`gelatoQuickMode:${storeSlug}`);
      return raw ? raw === 'true' : true; // default ON for gelato
    } catch {
      return true;
    }
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === 'undefined') return categories[0]?.id || '';
    try {
      return localStorage.getItem(`stocktakeActiveTab:${storeSlug}`) || categories[0]?.id || '';
    } catch {
      return categories[0]?.id || '';
    }
  });
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Draft key includes store and date
  const draftKey = `stocktakeDraft:${storeSlug}:${date}`;

  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setValues(parsed.values || {});
          setNotes(parsed.notes || '');
          setPhotoUrl(parsed.photoUrl || undefined);
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
        localStorage.setItem(draftKey, JSON.stringify({ values, notes, photoUrl }));
        setDraftSavedAt(Date.now());
      } catch {}
    }, 400);
  }

  useEffect(() => { queueSaveDraft(); }, [values]);
  useEffect(() => { queueSaveDraft(); }, [notes]);
  useEffect(() => { queueSaveDraft(); }, [photoUrl]);
  // Persist active tab per store
  useEffect(() => {
    try { localStorage.setItem(`stocktakeActiveTab:${storeSlug}`, activeTab); } catch {}
  }, [activeTab, storeSlug]);

  // Persist Gelato Quick Mode per store
  useEffect(() => {
    try { localStorage.setItem(`gelatoQuickMode:${storeSlug}`, String(gelatoQuickMode)); } catch {}
  }, [gelatoQuickMode, storeSlug]);

  const itemsFlat = useMemo(() => categories.flatMap((c) => c.items), [categories]);

  function updateQuantity(itemId: string, q: string) {
    const num = q === '' ? undefined : Number(q);
    setValues((v) => ({ ...v, [itemId]: { ...(v[itemId] || {}), quantity: Number.isFinite(num as number) ? (num as number) : undefined } }));
  }

  function updateItemNote(itemId: string, note: string) {
    setValues((v) => ({ ...v, [itemId]: { ...(v[itemId] || {}), note: note || undefined } }));
  }

  function nudge(itemId: string, delta: number) {
    setValues((v) => {
      const curr = v[itemId]?.quantity ?? 0;
      const next = Math.max(0, Math.round((curr + delta) * 100) / 100);
      return { ...v, [itemId]: { ...(v[itemId] || {}), quantity: next } };
    });
  }

  // Long-press support for +/- on touch devices
  const pressTimers = useRef<Record<string, NodeJS.Timeout | number>>({});
  function startPress(itemId: string, delta: number) {
    if (activePress) clearPress(activePress);
    setActivePress(itemId + ':' + delta);
    nudge(itemId, delta);
    const tick = () => {
      nudge(itemId, delta);
      pressTimers.current[itemId + ':' + delta] = setTimeout(tick, 120);
    };
    pressTimers.current[itemId + ':' + delta] = setTimeout(tick, 500);
  }
  function clearPress(key?: string) {
    const k = key || activePress;
    if (!k) return;
    const t = pressTimers.current[k];
    if (t) clearTimeout(t as number);
    delete pressTimers.current[k];
    setActivePress(null);
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
      const res = await fetch('/api/stocktakes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to submit');
      setMessage('Submitted!');
      setValues({});
      try { localStorage.removeItem(draftKey); } catch {}
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error submitting';
      setMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function focusNextEmpty() {
    // Find next item without a value within the visible (active tab + filter) items
    const allIds = visibleCategories.flatMap((c) => c.items.map((i) => i.id));
    const nextId = allIds.find((id) => values[id]?.quantity == null || values[id]?.quantity === undefined);
    if (nextId) {
      const ref = inputRefs.current[nextId];
      if (ref) ref.focus();
    }
  }

  function focusPrevOrNext(itemId: string, dir: -1 | 1) {
    const allIds = visibleCategories.flatMap((c) => c.items.map((i) => i.id));
    const idx = allIds.indexOf(itemId);
    const nextIdx = Math.min(allIds.length - 1, Math.max(0, idx + dir));
    const nextId = allIds[nextIdx];
    const el = inputRefs.current[nextId];
    if (el) el.focus();
  }

  const filteredCategories = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const sourceCats = categories;
    if (!q) return sourceCats;
    return sourceCats
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => i.name.toLowerCase().includes(q)),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, filter]);

  const visibleCategories = useMemo(() => {
    // When tabs are present, only show the active category section; search still filters within it
    const active = filteredCategories.find((c) => c.id === activeTab) || filteredCategories[0];
    return active ? [active] : [];
  }, [filteredCategories, activeTab]);

  return (
    <div className="space-y-6">
      {/* small draft saved indicator */}
      <div className="text-xs text-gray-500">{draftSavedAt ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}` : ' '}</div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-green-800 mb-2">📝 Stocktake Instructions</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• Count ALL items currently in your store</li>
          <li>• Include gelato tubs, cleaning supplies, packaging, and other inventory</li>
          <li>• Include leftover stock from previous deliveries</li>
          <li>• Include partial quantities (e.g., 50% for half-full tubs)</li>
          <li>• Do not count empty or damaged items</li>
          <li>• Take a photo of your store inventory for reference</li>
        </ul>
      </div>

  <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2 text-sm min-h-[40px]" />
        </div>
        <div className="flex-1">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search items…"
            className="w-full border rounded px-3 py-2 text-sm min-h-[40px]"
          />
        </div>
        <div>
          <button onClick={focusNextEmpty} className="px-3 py-2 border rounded text-sm min-h-[40px]">Next empty</button>
        </div>
        {(() => {
          const activeCat = filteredCategories.find((c) => c.id === activeTab);
          const isGelato = activeCat?.name === 'Gelato Flavors';
          if (!isGelato) return null;
          return (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Gelato quick mode</label>
              <button
                onClick={() => setGelatoQuickMode((v) => !v)}
                className={`px-3 py-1.5 rounded border text-sm ${gelatoQuickMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                aria-pressed={gelatoQuickMode}
              >
                {gelatoQuickMode ? 'On' : 'Off'}
              </button>
            </div>
          );
        })()}
      </div>

      {/* Category tabs */}
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b">
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-1 py-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveTab(c.id)}
                className={`${activeTab === c.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'} px-3 py-2 rounded-md whitespace-nowrap text-sm`}
                aria-current={activeTab === c.id ? 'page' : undefined}
                role="tab"
              >
                {c.name}
                <span className="ml-1 text-xs opacity-80">({c.items.length})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleCategories.map((cat) => (
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
                {/* Unified card grid for all categories. For Gelato, respects quick mode toggle; others always use card grid. */}
                {(cat.name !== 'Gelato Flavors') || (cat.name === 'Gelato Flavors' && gelatoQuickMode) ? (
                  <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {cat.items.map((item) => {
                      const step = cat.name === 'Gelato Flavors' ? 0.5 : 1;
                      const v = values[item.id]?.quantity ?? 0;
                      const setQ = (n: number | undefined) => updateQuantity(item.id, n == null ? '' : String(n));
                      const targetDisplay = item.targetText ?? (
                        item.targetNumber != null ? `${item.targetNumber}${item.unit ? ` ${item.unit}` : ''}` : null
                      );
                      return (
                        <div key={item.id} className="border rounded p-2 flex flex-col gap-2" ref={(el) => { rowRefs.current[item.id] = el; }}>
                          <div className="min-w-0">
                            <div className="font-medium text-sm break-words leading-snug" title={item.name}>{item.name}</div>
                            {targetDisplay ? (
                              <div className="mt-0.5">
                                <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[11px]">
                                  Target: {targetDisplay}
                                </span>
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setQ(Math.max(0, (v || 0) - step))} className="w-8 h-8 rounded border text-lg hover:bg-gray-50" aria-label="decrease">−</button>
                            <input
                              inputMode="decimal"
                              step={step}
                              value={v === 0 ? '' : String(v)}
                              onChange={(e) => updateQuantity(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') focusNextEmpty();
                                if (e.key === 'ArrowDown') focusPrevOrNext(item.id, +1);
                                if (e.key === 'ArrowUp') focusPrevOrNext(item.id, -1);
                              }}
                              placeholder={cat.name === 'Gelato Flavors' ? 'Qty (tubs/trays)' : 'Qty'}
                              className="w-20 border rounded px-2 py-1 text-right text-sm"
                            />
                            <button onClick={() => setQ((v || 0) + step)} className="w-8 h-8 rounded border text-lg hover:bg-gray-50" aria-label="increase">+</button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {step === 0.5 ? (
                              <>
                                <button onClick={() => setQ(0)} className="px-2 py-0.5 text-[11px] border rounded">Empty</button>
                                <button onClick={() => setQ(0.5)} className="px-2 py-0.5 text-[11px] border rounded">50%</button>
                                <button onClick={() => setQ(1)} className="px-2 py-0.5 text-[11px] border rounded">Full</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setQ(undefined)} className="px-2 py-0.5 text-[11px] border rounded">Clear</button>
                                <button onClick={() => setQ(1)} className="px-2 py-0.5 text-[11px] border rounded">1</button>
                              </>
                            )}
                          </div>
                          <input
                            value={values[item.id]?.note || ''}
                            onChange={(e) => updateItemNote(item.id, e.target.value)}
                            placeholder="Note (optional)"
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Gelato detailed list when quick mode is OFF
                  cat.items.map((item) => {
                    const step = 0.5;
                    const v = values[item.id]?.quantity ?? 0;
                    return (
                      <div key={item.id} className="p-2" ref={(el) => { rowRefs.current[item.id] = el; }}>
                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_auto_auto] items-center gap-2 sm:gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm whitespace-normal break-words leading-snug" title={item.name}>{item.name}</div>
                            {(() => {
                              const targetDisplay = item.targetText ?? (
                                item.targetNumber != null
                                  ? `${item.targetNumber}${item.unit ? ` ${item.unit}` : ''}`
                                  : null
                              );
                              return targetDisplay ? (
                                <div className="mt-0.5">
                                  <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[11px]">
                                    Target: {targetDisplay}
                                  </span>
                                </div>
                              ) : null;
                            })()}
                            {item.lastDelivered && (
                              <div className="text-[11px] text-blue-600 mt-0.5">
                                Last delivered: {new Date(item.lastDelivered).toLocaleDateString()}
                                {item.totalDelivered && ` (Total: ${item.totalDelivered} tubs)`}
                                {item.deliveryCount && item.deliveryCount > 1 && ` • ${item.deliveryCount} deliveries`}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              aria-label="decrease"
                              onMouseDown={() => startPress(item.id, -step)}
                              onTouchStart={() => startPress(item.id, -step)}
                              onMouseUp={() => clearPress()}
                              onMouseLeave={() => clearPress()}
                              onTouchEnd={() => clearPress()}
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded border text-lg hover:bg-gray-50"
                            >
                              −
                            </button>
                            <input
                              ref={(el) => { inputRefs.current[item.id] = el; }}
                              inputMode="decimal"
                              step={step}
                              value={v === 0 ? '' : String(v)}
                              onChange={(e) => updateQuantity(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') focusNextEmpty();
                                if (e.key === 'ArrowDown') focusPrevOrNext(item.id, +1);
                                if (e.key === 'ArrowUp') focusPrevOrNext(item.id, -1);
                              }}
                              placeholder={'Qty (tubs/trays)'}
                              className="w-20 sm:w-24 border rounded px-2 py-2 text-right text-base min-h-[40px] tabular-nums"
                            />
                            <button
                              aria-label="increase"
                              onMouseDown={() => startPress(item.id, +step)}
                              onTouchStart={() => startPress(item.id, +step)}
                              onMouseUp={() => clearPress()}
                              onMouseLeave={() => clearPress()}
                              onTouchEnd={() => clearPress()}
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded border text-lg hover:bg-gray-50"
                            >
                              +
                            </button>
                          </div>
                          <div className="hidden lg:flex items-center gap-1 whitespace-nowrap">
                            <button onClick={() => updateQuantity(item.id, '0')} className="px-2 py-0.5 text-[11px] border rounded">Empty</button>
                            <button onClick={() => updateQuantity(item.id, '0.5')} className="px-2 py-0.5 text-[11px] border rounded">50%</button>
                            <button onClick={() => updateQuantity(item.id, '1')} className="px-2 py-0.5 text-[11px] border rounded">Full</button>
                          </div>
                        </div>
                        <div className="w-full mt-1.5">
                          <input
                            value={values[item.id]?.note || ''}
                            onChange={(e) => updateItemNote(item.id, e.target.value)}
                            placeholder="Note (optional)"
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
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
          cameraOnly
        />
      </div>

      <div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          className="w-full border rounded px-3 py-3 min-h-24 text-base"
        />
      </div>

      <div className="sticky bottom-4 flex items-center gap-3 bg-white/80 backdrop-blur p-2 rounded-lg border shadow-sm w-fit">
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="bg-black text-white rounded px-4 py-3 disabled:opacity-50 text-base min-h-[48px]"
        >
          {submitting ? 'Submitting…' : 'Submit nightly stocktake'}
        </button>
        {message && <div className="text-sm text-gray-600">{message}</div>}
      </div>
    </div>
  );
}

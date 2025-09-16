"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function AssignPackagingFormClient({ options, flavors, defaultItemId, defaultId, defaultIdStores, defaultIdCustomers, preselectedIds, action }: {
  options: Array<{ id: string; name: string }>,
  flavors: Array<{ id: string; name: string }>,
  defaultItemId?: string,
  defaultId?: string,
  defaultIdStores?: string,
  defaultIdCustomers?: string,
  preselectedIds?: string[],
  action: (formData: FormData) => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(preselectedIds || []);
  const [anyDefault, setAnyDefault] = useState<string>('');
  const [storesDefault, setStoresDefault] = useState<string>('');
  const [customersDefault, setCustomersDefault] = useState<string>('');

  // Ensure defaults are valid members of selectedIds
  useEffect(() => {
    const normalize = (val?: string) => (val && selectedIds.includes(val) ? val : '');
    setAnyDefault((v) => normalize(v) || normalize(defaultId));
    setStoresDefault((v) => normalize(v) || normalize(defaultIdStores));
    setCustomersDefault((v) => normalize(v) || normalize(defaultIdCustomers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const selectedOptions = useMemo(() => options.filter(o => selectedIds.includes(o.id)), [options, selectedIds]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter(x => x !== id) : [...prev, id];
      // If removing a default option, clear it
      if (!next.includes(anyDefault)) setAnyDefault('');
      if (!next.includes(storesDefault)) setStoresDefault('');
      if (!next.includes(customersDefault)) setCustomersDefault('');
      return next;
    });
  };

  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('selected', selectedIds.join(','));
    fd.set('defaultId', anyDefault || '');
    fd.set('defaultStoresId', storesDefault || '');
    fd.set('defaultCustomersId', customersDefault || '');
    action(fd);
  }, [action, selectedIds, anyDefault, storesDefault, customersDefault]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Flavor</label>
          <select name="itemId" required className="w-full border border-gray-300 rounded-md px-3 py-2" defaultValue={defaultItemId || ''}>
            <option value="">Select flavor</option>
            {flavors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Packaging</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border border-gray-200 rounded p-3 max-h-60 overflow-auto">
            {options.map((o) => {
              const checked = selectedIds.includes(o.id);
              return (
                <label key={o.id} className={`flex items-center gap-2 text-sm rounded-md border px-3 py-2 cursor-pointer select-none hover:bg-gray-50 ${checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}> 
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={checked}
                    onChange={() => toggleSelected(o.id)}
                  />
                  <span className="truncate">{o.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded p-4">
        <div className="text-sm font-medium text-gray-700 mb-3">Defaults</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Default (Any)</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={anyDefault}
              onChange={(e) => setAnyDefault(e.target.value)}
            >
              <option value="">— none —</option>
              {selectedOptions.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Default (Stores)</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={storesDefault}
              onChange={(e) => setStoresDefault(e.target.value)}
            >
              <option value="">— none —</option>
              {selectedOptions.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Default (Customers)</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={customersDefault}
              onChange={(e) => setCustomersDefault(e.target.value)}
            >
              <option value="">— none —</option>
              {selectedOptions.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Defaults can only be set from the checked options above.</p>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Mapping</button>
      </div>
      <p className="text-xs text-gray-500">Tip: If a flavor has no mapping, all allowed options will be shown by default.</p>
    </form>
  );
}

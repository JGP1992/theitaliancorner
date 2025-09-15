'use client';

import React from 'react';

type FlavorRow = {
  id: string;
  name: string;
  unit?: string | null;
  targetText?: string | null;
  targetNumber?: number | null;
  defaultQuantity?: number | null;
  sortOrder?: number | null;
  isActive?: boolean;
};

export default function FlavorInlineEditor({ initialFlavors }: { initialFlavors: FlavorRow[] }) {
  const [rows, setRows] = React.useState(initialFlavors);
  const [saving, setSaving] = React.useState({} as Record<string, boolean>);
  const [savedAt, setSavedAt] = React.useState({} as Record<string, number>);

  const save = async (id: string, patch: Partial<FlavorRow>) => {
    try {
      setSaving((s: any) => ({ ...s, [id]: true }));
      const res = await fetch(`/api/flavors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedAt((s: any) => ({ ...s, [id]: Date.now() }));
      // Optimistically update local state
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    } catch (e) {
      console.error(e);
    } finally {
      setSaving((s: any) => ({ ...s, [id]: false }));
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Unit</th>
            <th className="px-3 py-2 text-left">Target Text</th>
            <th className="px-3 py-2 text-left">Target #</th>
            <th className="px-3 py-2 text-left">Default Qty</th>
            <th className="px-3 py-2 text-left">Sort</th>
            <th className="px-3 py-2 text-left">Active</th>
            <th className="px-3 py-2 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((f) => {
            const justSaved = savedAt[f.id] && Date.now() - (savedAt[f.id] || 0) < 2000;
            return (
              <tr key={f.id} className="align-top">
                <td className="px-3 py-2">
                  <input
                    defaultValue={f.name}
                    className="w-44 border rounded px-2 py-1"
                    onBlur={(e) => save(f.id, { name: e.currentTarget.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    defaultValue={f.unit || ''}
                    className="w-24 border rounded px-2 py-1"
                    onBlur={(e) => save(f.id, { unit: e.currentTarget.value || null })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    defaultValue={f.targetText || ''}
                    className="w-56 border rounded px-2 py-1"
                    onBlur={(e) => save(f.id, { targetText: e.currentTarget.value || null })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={f.targetNumber ?? ''}
                    className="w-24 border rounded px-2 py-1"
                    onBlur={(e) => save(f.id, { targetNumber: e.currentTarget.value ? Number(e.currentTarget.value) : null })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={f.defaultQuantity ?? ''}
                    className="w-24 border rounded px-2 py-1"
                    onBlur={(e) => save(f.id, { defaultQuantity: e.currentTarget.value ? Number(e.currentTarget.value) : null })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    defaultValue={f.sortOrder ?? 0}
                    className="w-20 border rounded px-2 py-1"
                    onBlur={(e) => save(f.id, { sortOrder: Number(e.currentTarget.value || 0) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      defaultChecked={!!f.isActive}
                      onChange={(e) => save(f.id, { isActive: e.currentTarget.checked })}
                    />{' '}
                    Active
                  </label>
                </td>
                <td className="px-3 py-2 text-right align-middle">
                  {saving[f.id] ? (
                    <span className="text-xs text-gray-500">Saving…</span>
                  ) : justSaved ? (
                    <span className="text-xs text-green-600">Saved</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

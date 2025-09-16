"use client";

import "../../globals.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  date: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  quantity: number;
  unit: string;
  notes?: string | null;
  item: { id: string; name: string; category?: { name: string } | null };
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  totalWeightKg?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  packagingOption?: { id: string; name: string; sizeValue?: number | null; sizeUnit?: string | null; type?: string | null } | null;
};

export default function FactoryProductionTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | Task["status"]>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "status" | "assignee">("name");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Local YYYY-MM-DD (avoid UTC off-by-one)
  const today = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/production-tasks?start=${today}&end=${today}`, { credentials: "include", cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load");
        setTasks(data.tasks || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [today]);

  type TaskPatch = Partial<{ start: boolean; complete: boolean; cancel: boolean; notes: string; totalWeightKg: number }>;
  const updateTask = async (id: string, patch: TaskPatch) => {
    try {
      setUpdating((u) => ({ ...u, [id]: true }));
      const res = await fetch(`/api/production-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Update failed");
      setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating((u) => ({ ...u, [id]: false }));
    }
  };

  const assignees = useMemo(() => {
    const map: Record<string, string> = {};
    tasks.forEach((t) => {
      if (t.assignedTo) map[t.assignedTo.id] = `${t.assignedTo.firstName} ${t.assignedTo.lastName}`;
    });
    return map;
  }, [tasks]);

  const todays = useMemo(() => {
    let list = tasks.filter((t) => t.status !== "CANCELLED");
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    if (assigneeFilter !== "all") list = list.filter((t) => t.assignedTo?.id === assigneeFilter);
    if (sortBy === "name") list = list.sort((a, b) => a.item.name.localeCompare(b.item.name));
    else if (sortBy === "status") list = list.sort((a, b) => a.status.localeCompare(b.status));
    else if (sortBy === "assignee") list = list.sort((a, b) => (a.assignedTo?.firstName || "").localeCompare(b.assignedTo?.firstName || ""));
    return list;
  }, [tasks, statusFilter, assigneeFilter, sortBy]);

  function StatusBadge({ status }: { status: Task["status"] }) {
    const map: Record<Task["status"], { label: string; cls: string }> = {
      SCHEDULED: { label: "Scheduled", cls: "bg-gray-100 text-gray-700 border-gray-200" },
      IN_PROGRESS: { label: "In progress", cls: "bg-blue-50 text-blue-700 border-blue-200" },
      DONE: { label: "Done", cls: "bg-green-50 text-green-700 border-green-200" },
      CANCELLED: { label: "Cancelled", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    };
    const s = map[status];
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${s.cls}`}>{s.label}</span>;
  }

  function Spinner({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
    return (
      <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke={color} strokeWidth="4" />
        <path className="opacity-75" fill={color} d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    );
  }

  const summary = useMemo(() => {
    const total = tasks.filter((t) => t.status !== "CANCELLED").length;
    const scheduled = tasks.filter((t) => t.status === "SCHEDULED").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const cancelled = tasks.filter((t) => t.status === "CANCELLED").length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, scheduled, inProgress, done, cancelled, pct };
  }, [tasks]);

  function TaskProgress({ status }: { status: Task["status"] }) {
    const value = status === "SCHEDULED" ? 0 : status === "IN_PROGRESS" ? 50 : status === "DONE" ? 100 : 0;
    const bar = value <= 33 ? "bg-gray-300" : value <= 66 ? "bg-blue-400" : "bg-green-500";
    return (
      <div className="mt-1 h-1.5 w-40 bg-gray-100 rounded">
        <div className={`h-1.5 rounded ${bar}`} style={{ width: `${value}%` }} />
      </div>
    );
  }

  function formatQtyUnit(q: number, u: string) {
    const isOne = Math.abs(q - 1) < 1e-9;
    const sym = u.toLowerCase();
    if (sym === "kg" || sym === "l" || sym === "ml" || sym === "g") return `${q} ${sym}`;
    if (sym.endsWith("s")) {
      return `${q} ${isOne ? sym.slice(0, -1) : sym}`;
    }
    return `${q} ${sym}`;
  }

  // Extract packaging label from notes if present
  function packagingFromNotes(notes?: string | null): string | null {
    if (!notes) return null;
    const m = notes.match(/Packaging:\s*([^|\n\r]+)/i);
    return m ? m[1].trim() : null;
  }

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
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold">{new Date(today).toLocaleDateString()}</h2>
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600">
                <StatusBadge status={"SCHEDULED"} />
                <span>{summary.scheduled}</span>
                <span className="text-gray-300">•</span>
                <StatusBadge status={"IN_PROGRESS"} />
                <span>{summary.inProgress}</span>
                <span className="text-gray-300">•</span>
                <StatusBadge status={"DONE"} />
                <span>{summary.done}</span>
                {summary.cancelled > 0 && (
                  <>
                    <span className="text-gray-300">•</span>
                    <StatusBadge status={"CANCELLED"} />
                    <span>{summary.cancelled}</span>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 w-full bg-gray-100 rounded">
                <div className="h-2 rounded bg-green-500 transition-[width] duration-300" style={{ width: `${summary.pct}%` }} />
              </div>
              <div className="mt-1 text-xs text-gray-600">{summary.pct}% complete</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <div>
                  <label className="text-xs text-gray-600">Status</label>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full border rounded px-2 py-1 text-sm">
                    <option value="all">All</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Assignee</label>
                  <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
                    <option value="all">All</option>
                    {Object.entries(assignees).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Sort by</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-full border rounded px-2 py-1 text-sm">
                    <option value="name">Name</option>
                    <option value="status">Status</option>
                    <option value="assignee">Assignee</option>
                  </select>
                </div>
                <div className="flex items-end justify-end">
                  <button
                    onClick={async () => {
                      const toComplete = todays.filter((t) => !t.unit.toLowerCase().includes("tray") && t.status !== "DONE" && t.status !== "CANCELLED" && selected[t.id]);
                      for (const t of toComplete) {
                        await updateTask(t.id, { complete: true });
                      }
                      setSelected({});
                    }}
                    className="px-3 py-2 bg-green-600 text-white rounded text-sm disabled:opacity-50"
                    disabled={!todays.some((t) => selected[t.id])}
                  >Complete Selected</button>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-4 text-gray-600">Loading…</div>
          ) : error ? (
            <div className="p-4 text-red-700">{error}</div>
          ) : todays.length === 0 ? (
            <div className="p-4 text-gray-600">No tasks for today.</div>
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
                    <th className="px-4 py-2">Progress</th>
                    <th className="px-4 py-2">Weight (kg)</th>
                    <th className="px-4 py-2">Started / Completed</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {todays.map((t) => (
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
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3">{t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : "Unassigned"}</td>
                      <td className="px-4 py-3"><TaskProgress status={t.status} /></td>
                      <td className="px-4 py-3">
                        {t.unit.toLowerCase().includes("tray") && (t.status === "SCHEDULED" || t.status === "IN_PROGRESS") ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={weights[t.id] ?? ""}
                              onChange={(e) => setWeights((w) => ({ ...w, [t.id]: e.target.value }))}
                              placeholder="e.g., 12.4"
                              inputMode="decimal"
                              className="border rounded px-2 py-1 text-xs w-24"
                            />
                            {typeof t.totalWeightKg === "number" && (
                              <span className="text-xs text-gray-500">Saved: {t.totalWeightKg} kg</span>
                            )}
                          </div>
                        ) : (
                          typeof t.totalWeightKg === "number" ? <span className="text-gray-700">{t.totalWeightKg} kg</span> : <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {t.startedAt && (<div>Started: {new Date(t.startedAt).toLocaleString()} {t.assignedTo ? `by ${t.assignedTo.firstName}` : ""}</div>)}
                        {t.completedAt && (<div className="mt-0.5">Completed: {new Date(t.completedAt).toLocaleString()} {t.assignedTo ? `by ${t.assignedTo.firstName}` : ""}</div>)}
                        {!t.startedAt && t.status === "SCHEDULED" && <div>Not started</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {t.status === "SCHEDULED" && (
                            <button
                              onClick={() => updateTask(t.id, { start: true })}
                              disabled={!!updating[t.id]}
                              className={`px-3 py-1 text-sm rounded text-white inline-flex items-center gap-2 ${updating[t.id] ? "bg-amber-300" : "bg-amber-500 hover:bg-amber-600"}`}
                            >{updating[t.id] && <Spinner color="#78350f" />}<span>{updating[t.id] ? "Starting…" : "Start"}</span></button>
                          )}
                          {t.status !== "DONE" && t.status !== "CANCELLED" && (
                            <button
                              onClick={() => {
                                const patch: TaskPatch = { complete: true };
                                if (t.unit.toLowerCase().includes("tray")) {
                                  const raw = weights[t.id]?.trim();
                                  const w = raw ? parseFloat(raw) : undefined;
                                  if (w != null && Number.isFinite(w)) patch.totalWeightKg = w;
                                }
                                updateTask(t.id, patch);
                              }}
                              disabled={!!updating[t.id] || (t.unit.toLowerCase().includes("tray") && !(Number.isFinite(parseFloat(weights[t.id] ?? "")) && parseFloat(weights[t.id] ?? "") > 0))}
                              className={`px-3 py-1 text-sm rounded text-white inline-flex items-center gap-2 ${updating[t.id] ? "bg-green-300" : "bg-green-600 hover:bg-green-700"}`}
                            >{updating[t.id] && <Spinner color="#064e3b" />}<span>{updating[t.id] ? "Finishing…" : "Done"}</span></button>
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

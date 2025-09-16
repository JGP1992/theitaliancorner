'use client';

import '../globals.css';
import { useState, useEffect } from 'react';
import { Package, TrendingUp, TrendingDown, AlertTriangle, Plus, Minus, Eye, Trash2, Info, ChevronDown, ChevronUp, Download } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  baselineQuantity: number;
  derivedCurrent: number;
  netMovement: number;
  unit: string;
  incoming: number;
  outgoing: number;
  production: number;
  targetStock: number;
  status: 'low' | 'normal' | 'high' | 'critical';
}

interface InventorySummary {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  incomingToday: number;
  outgoingToday: number;
  productionToday: number;
}

export default function InventoryDashboard() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    totalItems: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    incomingToday: 0,
    outgoingToday: 0,
    productionToday: 0
  });
  const [baseline, setBaseline] = useState<'master' | 'latest'>('latest'); // actual baseline used (returned by API)
  const [baselineMode, setBaselineMode] = useState<'auto' | 'master' | 'latest'>('auto'); // user selection
  const [baselineDate, setBaselineDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [movementSummary, setMovementSummary] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const todayISO = new Date().toISOString().slice(0,10);
  const [dateFrom, setDateFrom] = useState<string>(todayISO);
  const [dateTo, setDateTo] = useState<string>(todayISO);
  const [partialWindow, setPartialWindow] = useState<boolean>(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItemName, setHistoryItemName] = useState('');
  const [historyRows, setHistoryRows] = useState<Array<{date:string; incoming:number; outgoing:number; production:number; net:number}>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const multiDay = dateFrom !== dateTo;

  // Date preset helpers
  const applyPreset = (type: string) => {
    const today = new Date();
    const toISO = (d: Date) => d.toISOString().slice(0,10);
    if (type === 'today') {
      const iso = toISO(today); setDateFrom(iso); setDateTo(iso); return;
    }
    if (type === 'yesterday') {
      const y = new Date(today.getTime()); y.setDate(y.getDate()-1); const iso = toISO(y); setDateFrom(iso); setDateTo(iso); return;
    }
    if (type === 'last7') {
      const start = new Date(today.getTime()); start.setDate(start.getDate()-6); setDateFrom(toISO(start)); setDateTo(toISO(today)); return;
    }
    if (type === 'mtd') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1); setDateFrom(toISO(start)); setDateTo(toISO(today)); return;
    }
    if (type === 'last30') {
      const start = new Date(today.getTime());
      start.setDate(start.getDate() - 29); // inclusive of today
      setDateFrom(toISO(start)); setDateTo(toISO(today)); return;
    }
    if (type === 'prevMonth') {
      // Determine the first and last day of the previous month
      const firstOfCurrent = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastOfPrev = new Date(firstOfCurrent.getFullYear(), firstOfCurrent.getMonth(), 0); // day 0 of current month = last day of prev month
      const startPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1);
      setDateFrom(toISO(startPrev)); setDateTo(toISO(lastOfPrev)); return;
    }
  };

  const openHistory = async (item: InventoryItem) => {
    setHistoryItemName(item.name);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
  const params = new URLSearchParams({ itemId: item.id, from: dateFrom, to: dateTo });
  if (baselineMode !== 'auto') params.set('baselineMode', baselineMode);
      const res = await fetch(`/api/inventory/item-history?${params.toString()}`, { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setHistoryRows(data.days || []);
      }
    } catch (e) {
      console.error('History fetch failed', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, baselineMode]);

  const fetchInventoryData = async () => {
    try {
  const params = new URLSearchParams({ from: dateFrom, to: dateTo });
  if (baselineMode !== 'auto') params.set('baselineMode', baselineMode);
      const response = await fetch(`/api/inventory/dashboard?${params.toString()}` as string, { credentials: 'include', cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setInventory(data.inventory);
        setSummary(data.summary);
        setMovementSummary(data.movementSummary || null);
        if (data.baseline) setBaseline(data.baseline);
        if (data.baselineDate) setBaselineDate(data.baselineDate);
        if (typeof data.partialWindow === 'boolean') setPartialWindow(data.partialWindow);
      }
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromFactoryInventory = async (itemId: string, itemName: string) => {
    if (!confirm(`Remove "${itemName}" from the Factory's inventory list?`)) return;
    setRemovingId(itemId);
    setMessage(null);
    try {
      const res = await fetch('/api/stores/factory/inventory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to remove item');
      }
      // Optimistically hide the item locally
      setInventory((prev) => prev.filter((i) => i.id !== itemId));
      setMessage('Item removed from Factory inventory.');
    } catch (e: any) {
      setMessage(e?.message || 'Failed to remove item');
    } finally {
      setRemovingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'low': return <TrendingDown className="h-4 w-4" />;
      case 'high': return <TrendingUp className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const totalFiltered = filteredInventory.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const pagedInventory = filteredInventory.slice((page-1)*pageSize, (page-1)*pageSize + pageSize);
  const pageTotals = pagedInventory.reduce((acc, i) => {
    acc.current += i.derivedCurrent || 0;
    acc.incoming += i.incoming || 0;
    acc.outgoing += i.outgoing || 0;
    acc.production += i.production || 0;
    return acc;
  }, { current: 0, incoming: 0, outgoing: 0, production: 0 });

  const categories = Array.from(new Set(inventory.map(item => item.category)));

  const exportCsv = () => {
    const headers = [
      'Item','Category','Baseline','Incoming','Outgoing','Production','Net Movement','Derived Current','Unit','Target','Status'
    ];
    // Respect current filters in client-side CSV
    const rows = filteredInventory.map(i => [
      i.name,
      i.category,
      i.baselineQuantity,
      i.incoming,
      i.outgoing,
      i.production,
      i.netMovement,
      i.derivedCurrent,
      i.unit,
      i.targetStock,
      i.status
    ]);
    const csvContent = [headers, ...rows]
      .map(r => r.map(field => {
        if (field == null) return '';
        const s = String(field);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
      }).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const datePart = new Date().toISOString().slice(0,10);
    link.download = `inventory_${datePart}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Inventory Dashboard</h1>
          <p className="mt-2 text-gray-600">Comprehensive view of stock levels, movements, and forecasts</p>
        </div>

        {/* Summary + Baseline */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-gray-900">{summary.lowStockItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Plus className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Incoming {multiDay ? '(Range)' : 'Today'}</p>
                <p className="text-2xl font-bold text-gray-900">{summary.incomingToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Minus className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Outgoing {multiDay ? '(Range)' : 'Today'}</p>
                <p className="text-2xl font-bold text-gray-900">{summary.outgoingToday}</p>
              </div>
            </div>
          </div>
        </div>

        {baseline && (
          <div className="mb-6 space-y-2">
            <div className="text-sm text-gray-600">
              Baseline: {baseline === 'master' ? 'Factory master snapshot' : 'Latest available snapshot'}
              {baselineDate ? ` • as of ${new Date(baselineDate).toLocaleDateString()}` : ''}
            </div>
            <div className="text-xs md:text-sm rounded-md border border-blue-200 bg-blue-50 text-blue-800 p-3 leading-relaxed">
              Current Stock = Baseline quantity + Incoming (receipts) - Outgoing (deliveries / removals) +/- Production movements.
              <br />
              Use <span className="font-medium">Master Snapshot</span> for a full reset. Use <span className="font-medium">Incoming Stock</span> for daily receipts.
            </div>
          </div>
        )}

        {/* Filters + Actions */}
        <div className="mb-6 flex flex-col xl:flex-row gap-4 items-start xl:items-end">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-start">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">Baseline</label>
            <select
              value={baselineMode}
              onChange={(e) => { setBaselineMode(e.target.value as any); setLoading(true); }}
              className="block w-full pl-3 pr-8 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="auto">Auto</option>
              <option value="master">Master</option>
              <option value="latest">Latest</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setDrawerOpen(o => !o)}
              className="inline-flex items-center px-3 py-2 rounded-md bg-white border border-gray-300 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              {drawerOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              Movements
            </button>
            <button
              onClick={() => exportCsv()}
              className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium shadow hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-1" /> Export
            </button>
            <a
              href={`/api/inventory/export?from=${dateFrom}&to=${dateTo}${baselineMode !== 'auto' ? `&baselineMode=${baselineMode}` : ''}`}
              className="inline-flex items-center px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium shadow hover:bg-indigo-700"
            >
              <Download className="h-4 w-4 mr-1" /> Server Export
            </a>
          </div>
        </div>
        {/* Presets */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <button onClick={() => applyPreset('today')} className="px-2 py-1 rounded border bg-white hover:bg-gray-50">Today</button>
          <button onClick={() => applyPreset('yesterday')} className="px-2 py-1 rounded border bg-white hover:bg-gray-50">Yesterday</button>
            <button onClick={() => applyPreset('last7')} className="px-2 py-1 rounded border bg-white hover:bg-gray-50">Last 7 Days</button>
          <button onClick={() => applyPreset('mtd')} className="px-2 py-1 rounded border bg-white hover:bg-gray-50">Month-to-Date</button>
          <button onClick={() => applyPreset('last30')} className="px-2 py-1 rounded border bg-white hover:bg-gray-50">Last 30 Days</button>
          <button onClick={() => applyPreset('prevMonth')} className="px-2 py-1 rounded border bg-white hover:bg-gray-50">Previous Month</button>
        </div>
        {partialWindow && (
          <div className="mb-4 text-xs md:text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-3 leading-relaxed">
            Selected From date is earlier than the baseline snapshot date. Movements shown only reflect data from the baseline forward; earlier days are not included.
          </div>
        )}

        {/* Movement Drawer */}
        {drawerOpen && movementSummary && (
          <div className="mb-6 border border-gray-200 rounded-md bg-white p-4 text-sm">
            <div className="flex items-center mb-2 font-semibold text-gray-800">Cumulative Movement Since Baseline</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-1"><div className="text-gray-500 text-xs uppercase">Baseline Total</div><div className="font-medium">{movementSummary.baselineTotal}</div></div>
              <div className="space-y-1"><div className="text-gray-500 text-xs uppercase">Incoming</div><div className="text-green-600 font-medium">+{movementSummary.incomingTotal}</div></div>
              <div className="space-y-1"><div className="text-gray-500 text-xs uppercase">Outgoing</div><div className="text-red-600 font-medium">-{movementSummary.outgoingTotal}</div></div>
              <div className="space-y-1"><div className="text-gray-500 text-xs uppercase">Production</div><div className="text-blue-600 font-medium">{movementSummary.productionTotal >= 0 ? '+' : ''}{movementSummary.productionTotal}</div></div>
              <div className="space-y-1"><div className="text-gray-500 text-xs uppercase">Net Movement</div><div className={movementSummary.netMovementTotal >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{movementSummary.netMovementTotal >= 0 ? '+' : ''}{movementSummary.netMovementTotal}</div></div>
              <div className="space-y-1"><div className="text-gray-500 text-xs uppercase">Derived Current</div><div className="font-medium">{movementSummary.derivedCurrentTotal}</div></div>
            </div>
            <div className="mt-3 text-xs text-gray-500 leading-relaxed">Derived Current = Baseline Total + Incoming - Outgoing + Production. This drawer summarizes movements across all active items since the current baseline snapshot.</div>
          </div>
        )}

        {/* Inventory Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Incoming
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Outgoing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Production
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Change
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagedInventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{item.derivedCurrent} {item.unit}</span>
                      <div className="relative group">
                        <Info className="h-4 w-4 text-gray-400 group-hover:text-gray-600 cursor-pointer" />
                        <div className="absolute z-20 hidden group-hover:block w-64 md:w-72 top-full left-1/2 -translate-x-1/2 mt-2 p-3 rounded-md bg-white shadow-lg border border-gray-200 text-[11px] md:text-xs text-gray-700">
                          <div className="font-semibold mb-1">Stock Derivation</div>
                          <div className="space-y-0.5">
                            <div>Baseline: <span className="font-medium">{item.baselineQuantity}</span></div>
                            <div>Incoming: <span className="font-medium text-green-600">+{item.incoming}</span></div>
                            <div>Outgoing: <span className="font-medium text-red-600">-{item.outgoing}</span></div>
                            <div>Production: <span className="font-medium text-blue-600">{item.production >= 0 ? '+' : ''}{item.production}</span></div>
                            <div className="pt-1 border-t border-gray-100">Net Movement: <span className={item.netMovement >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{item.netMovement >= 0 ? '+' : ''}{item.netMovement}</span></div>
                            <div className="font-medium">Derived Current = Baseline + Net Movement</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">+{item.incoming} {item.unit}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    -{item.outgoing} {item.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{item.production >= 0 ? `+${item.production}` : item.production} {item.unit}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={item.netMovement >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {item.netMovement >= 0 ? '+' : ''}{item.netMovement} {item.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                      {getStatusIcon(item.status)}
                      <span className="ml-1 capitalize">{item.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button title="Movement history" onClick={() => openHistory(item)} className="text-blue-600 hover:text-blue-900">
                        <Eye className="h-5 w-5" />
                      </button>
                      <button
                        title="Remove from Factory inventory"
                        onClick={() => removeFromFactoryInventory(item.id, item.name)}
                        disabled={removingId === item.id}
                        className={`text-red-600 hover:text-red-900 disabled:opacity-50 ${removingId === item.id ? 'cursor-wait' : ''}`}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-6 py-3 text-left text-xs font-semibold text-gray-700" colSpan={2}>Totals (page)</td>
                <td className="px-6 py-3 text-sm font-semibold text-gray-900">{pageTotals.current}</td>
                <td className="px-6 py-3 text-sm font-semibold text-green-600">+{pageTotals.incoming}</td>
                <td className="px-6 py-3 text-sm font-semibold text-red-600">-{pageTotals.outgoing}</td>
                <td className="px-6 py-3 text-sm font-semibold text-blue-600">{pageTotals.production >= 0 ? `+${pageTotals.production}` : pageTotals.production}</td>
                <td className="px-6 py-3 text-sm font-semibold text-gray-700">—</td>
                <td className="px-6 py-3 text-sm font-semibold text-gray-700">—</td>
                <td className="px-6 py-3 text-right text-sm font-semibold text-gray-700">—</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {filteredInventory.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
          </div>
        )}

        {/* Pagination */}
        {filteredInventory.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1); }}
                className="border-gray-300 rounded-md text-sm"
              >
                {[10,25,50,100].map(sz => <option key={sz} value={sz}>{sz}</option>)}
              </select>
            </div>
            <div className="text-gray-600">{(page-1)*pageSize + 1} - {Math.min(page*pageSize, totalFiltered)} of {totalFiltered}</div>
            <div className="flex items-center gap-2">
              <button disabled={page===1} onClick={() => setPage(p => Math.max(1,p-1))} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
              <span className="text-gray-700">Page {page} / {totalPages}</span>
              <button disabled={page===totalPages} onClick={() => setPage(p => Math.min(totalPages,p+1))} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
            </div>
          </div>
        )}

        {message && (
          <div className={`mt-4 text-sm ${/success|removed|ok/i.test(message) ? 'text-green-700' : 'text-red-700'}`}>
            {message}
          </div>
        )}

        {historyOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Movement History • {historyItemName}</h2>
                <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
              </div>
              <div className="p-4 overflow-auto">
                {historyLoading && (
                  <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
                )}
                {!historyLoading && historyRows.length === 0 && (
                  <div className="py-8 text-center text-sm text-gray-500">No movement in selected range.</div>
                )}
                {!historyLoading && historyRows.length > 0 && (
                  <table className="min-w-full text-xs md:text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600">
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-left font-medium">Incoming</th>
                        <th className="px-3 py-2 text-left font-medium">Outgoing</th>
                        <th className="px-3 py-2 text-left font-medium">Production</th>
                        <th className="px-3 py-2 text-left font-medium">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {historyRows.map(r => (
                        <tr key={r.date} className="hover:bg-gray-50">
                          <td className="px-3 py-1 whitespace-nowrap font-mono">{r.date}</td>
                          <td className="px-3 py-1 text-green-600">+{r.incoming}</td>
                          <td className="px-3 py-1 text-red-600">-{r.outgoing}</td>
                          <td className="px-3 py-1 text-blue-600">{r.production >= 0 ? '+' : ''}{r.production}</td>
                          <td className={r.net >= 0 ? 'px-3 py-1 text-green-600 font-medium' : 'px-3 py-1 text-red-600 font-medium'}>
                            {r.net >= 0 ? '+' : ''}{r.net}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {!historyLoading && historyRows.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        const headers = ['Date','Incoming','Outgoing','Production','Net'];
                        const lines = [headers.join(',')].concat(historyRows.map(r => [r.date, r.incoming, r.outgoing, r.production, r.net].join(',')));
                        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = `history_${historyItemName.replace(/[^a-z0-9_-]+/gi,'_')}_${dateFrom}_${dateTo}.csv`;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-2 text-xs md:text-sm rounded-md bg-blue-600 text-white shadow hover:bg-blue-700"
                    >Download CSV</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import '../../globals.css';

import { useEffect, useState } from 'react';

type AuditLog = {
  id: string;
  userEmail?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: any;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  async function loadLogs(cursor?: string) {
    try {
      const url = new URL('/api/audit-logs', window.location.origin);
      url.searchParams.set('take', '50');
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setLogs((prev) => (cursor ? [...prev, ...data.logs] : data.logs));
      setNextCursor(data.nextCursor || null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="mt-2 text-gray-600">Record of user actions</p>
        </div>

        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={5}>Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={5}>No audit logs yet.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{log.userEmail || 'System'}</td>
                    <td className="px-4 py-3 text-sm"><span className="inline-flex px-2 py-1 rounded bg-gray-100 text-gray-800">{log.action}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-700">{log.resource}{log.resourceId ? ` • ${log.resourceId}` : ''}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[320px]">
                      {log.metadata ? JSON.stringify(log.metadata) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => loadLogs(nextCursor || undefined)}
            disabled={!nextCursor}
            className="px-4 py-2 bg-gray-100 rounded-md disabled:opacity-50"
          >
            {nextCursor ? 'Load more' : 'No more'}
          </button>
        </div>
      </div>
    </div>
  );
}

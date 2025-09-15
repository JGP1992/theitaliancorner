"use client";

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Global app error:', error);
  }, [error]);

  return (
    <div style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui, -apple-system' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        A client-side exception occurred. Try reloading, or click reset to attempt recovery.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => reset()} style={{ padding: '8px 12px', background: '#2563eb', color: 'white', borderRadius: 6 }}>Reset</button>
        <button onClick={() => location.reload()} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>Reload</button>
      </div>
      {process.env.NODE_ENV !== 'production' && (
        <pre style={{ marginTop: 16, fontSize: 12, whiteSpace: 'pre-wrap', color: '#ef4444' }}>
          {String(error?.stack || error?.message || 'Unknown error')}
        </pre>
      )}
    </div>
  );
}

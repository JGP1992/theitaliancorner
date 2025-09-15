'use client';

import { useState } from 'react';

type Props = {
  planId: string;
  onDone?: () => void;
  label?: string;
  className?: string;
};

export default function MarkAsSentButton({ planId, onDone, label = 'Ready to Dispatch', className = '' }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/delivery-plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'SENT' }),
      });
      if (!res.ok) throw new Error('Failed to update');
      if (onDone) onDone();
      else if (typeof window !== 'undefined') window.location.reload();
    } catch (e) {
      alert('Failed to mark as sent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60 ${className}`}
      title="Mark this plan as sent"
    >
      {loading ? 'Sending…' : label}
    </button>
  );
}

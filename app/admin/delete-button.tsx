'use client';

import { useState } from 'react';

interface DeleteButtonProps {
  id: string;
  type: 'store' | 'category' | 'item' | 'customer';
  name: string;
  onDelete: (id: string) => Promise<void>;
}

export default function DeleteButton({ id, type, name, onDelete }: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    const confirmMessage = getConfirmMessage(type, name);
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await onDelete(id);
      // Success - redirect to admin page
      window.location.href = '/admin';
    } catch (err) {
      console.error(`Failed to delete ${type}:`, err);
      setError(`Failed to delete ${type}. It may be in use.`);
      setIsDeleting(false);
    }
  };

  return (
    <div className="inline-block">
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
      {error && (
        <div className="mt-1 text-xs text-red-600 max-w-xs">
          {error}
        </div>
      )}
    </div>
  );
}

function getConfirmMessage(type: string, name: string): string {
  const messages = {
    store: `Are you sure you want to delete the store "${name}"? This will also delete all associated stocktakes and delivery plans.`,
    category: `Are you sure you want to delete the category "${name}"? All items in this category will also be deleted.`,
    item: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
    customer: `Are you sure you want to delete the customer "${name}"? This will also remove them from all delivery plans.`
  };

  return messages[type as keyof typeof messages] || `Are you sure you want to delete "${name}"?`;
}

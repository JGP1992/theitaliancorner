import React from 'react';

export default function Logo({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/Untitled.png"
        alt="Stocktake Management System"
        className="h-16 w-auto"
      />
    </div>
  );
}

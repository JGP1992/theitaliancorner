"use client";

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function Portal({ children }: { children: React.ReactNode }) {
  const elRef = useRef<HTMLElement | null>(null);
  if (!elRef.current && typeof document !== 'undefined') {
    elRef.current = document.createElement('div');
  }

  useEffect(() => {
    const el = elRef.current!;
    const root = document.body;
    root.appendChild(el);
    return () => {
      root.removeChild(el);
    };
  }, []);

  return elRef.current ? createPortal(children, elRef.current) : null;
}

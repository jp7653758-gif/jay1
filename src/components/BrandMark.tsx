import React from 'react';

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <span
        aria-hidden="true"
        className="brand-primary-bg inline-flex h-8 w-8 items-center justify-center rounded-lg shadow-xs"
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-white" fill="none">
          <path d="M6 12L12 6L18 12V15.5L12 9.5L6 15.5V12Z" fill="currentColor" />
          <path d="M6 18L12 12L18 18V21L12 15L6 21V18Z" fill="currentColor" opacity="0.88" />
        </svg>
      </span>
      <span className="font-display text-[17.5px] font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
        Share by Jalpi
      </span>
    </span>
  );
}

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { BrandMark } from './BrandMark';

interface HeaderProps {
  userLabel: string | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenAuth: (tab?: 'transfers' | 'payments') => void;
  onSendClick: () => void;
  isReceiverPage?: boolean;
  onBackHome?: () => void;
}

export function Header({
  userLabel,
  darkMode,
  onToggleDarkMode,
  onOpenAuth,
  onSendClick,
  isReceiverPage = false,
  onBackHome,
}: HeaderProps) {
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) {
        setScrollPct(0);
        return;
      }
      setScrollPct(Math.min(100, Math.max(0, (window.scrollY / max) * 100)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
      <div
        aria-hidden="true"
        className="brand-primary-bg h-[2.5px] transition-[width] duration-75"
        style={{ width: `${scrollPct}%` }}
      />
      <div className="mx-auto flex h-14 md:h-16 max-w-[1200px] items-center justify-between gap-4 md:gap-8 px-4 sm:px-8">
        {/* Zone 1: Brand Title */}
        <a
          href="/"
          aria-label="Share by Jalpi, home"
          onClick={(e) => {
            if (isReceiverPage && onBackHome) {
              e.preventDefault();
              onBackHome();
            }
          }}
          className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded-lg shrink-0"
        >
          <BrandMark />
        </a>

        {/* Zone 2: 4 single-line navigation links */}
        {!isReceiverPage && (
          <nav
            aria-label="Main"
            className="hidden md:flex items-center gap-7 text-[14px] font-medium text-slate-600 dark:text-slate-300"
          >
            <a
              href="#delivery"
              className="whitespace-nowrap shrink-0 hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors"
            >
              Delivery
            </a>
            <a
              href="#payments"
              className="whitespace-nowrap shrink-0 hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors"
            >
              Payments
            </a>
            <a
              href="#pricing"
              className="whitespace-nowrap shrink-0 hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors"
            >
              Pricing
            </a>
            <button
              type="button"
              onClick={() => onOpenAuth('transfers')}
              className="whitespace-nowrap shrink-0 hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              {userLabel ? 'Account' : 'Sign in'}
            </button>
          </nav>
        )}

        {/* Zone 3: Theme Toggle + Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            title={darkMode ? 'Light mode' : 'Dark mode'}
            onClick={onToggleDarkMode}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <a
            href="#send"
            onClick={(e) => {
              e.preventDefault();
              if (isReceiverPage && onBackHome) {
                onBackHome();
              } else {
                onSendClick();
              }
            }}
            className="brand-cta whitespace-nowrap shrink-0 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-white cursor-pointer"
          >
            Send files
          </a>
        </div>
      </div>
    </header>
  );
}

import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[12.5px] font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer min-h-[40px]'
            : 'inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 hover:border-blue-600 transition-colors cursor-pointer min-h-[44px]'
        }
      >
        {isInstallable ? (
          <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        )}
        <span>{isInstallable ? 'Install Phone App' : 'Get Phone App'}</span>
      </button>

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install Phone App"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs"
        >
          <div className="w-full sm:max-w-[420px] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[18px] font-bold text-slate-900 dark:text-slate-50">
                Install on your phone
              </h3>
              <button
                type="button"
                aria-label="Close install guide"
                onClick={() => setShowGuideModal(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {isIOS ? (
              <ol className="space-y-2.5 text-[14px] text-slate-600 dark:text-slate-300">
                <li>1. Open this page in Safari on your iPhone or iPad.</li>
                <li>
                  2. Tap the <strong className="text-slate-900 dark:text-white">Share</strong> icon
                  in the Safari toolbar.
                </li>
                <li>
                  3. Scroll down and choose{' '}
                  <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-[14px] text-slate-600 dark:text-slate-300">
                <li>1. Open Chrome or Edge on Android (or desktop).</li>
                <li>
                  2. Open the browser menu (three dots) and choose{' '}
                  <strong className="text-slate-900 dark:text-white">Install app</strong> or{' '}
                  <strong className="text-slate-900 dark:text-white">Add to Home screen</strong>.
                </li>
                <li>3. Launches full-screen like a native app with offline caching.</li>
              </ol>
            )}
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="brand-cta w-full rounded-xl py-3 text-[14px] font-semibold text-white cursor-pointer min-h-[44px]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/90 dark:border-amber-700 px-3.5 py-2 text-[12.5px] font-semibold text-amber-900 dark:text-amber-100 shadow-lg"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Offline — Cached app shell active</span>
    </div>
  );
}

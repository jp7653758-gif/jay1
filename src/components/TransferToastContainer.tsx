import React, { useState } from 'react';
import { Check, Copy, Maximize2, Radio, Upload, X } from 'lucide-react';
import {
  ActiveTransferToast,
  formatToastHeadline,
  formatToastMeta,
  isTransferActive,
} from '../utils/transferToasts';

interface TransferToastContainerProps {
  toasts: ActiveTransferToast[];
  onRestore: () => void;
  onDismiss: (code: string) => void;
}

export function TransferToastContainer({
  toasts,
  onRestore,
  onDismiss,
}: TransferToastContainerProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (toasts.length === 0) return null;

  const handleCopy = async (toast: ActiveTransferToast) => {
    await navigator.clipboard.writeText(toast.shareUrl);
    setCopiedCode(toast.code);
    window.setTimeout(() => setCopiedCode((prev) => (prev === toast.code ? null : prev)), 1800);
  };

  return (
    <aside
      role="region"
      aria-label="Active transfer notifications"
      aria-live="polite"
      className="fixed bottom-18 md:bottom-4 right-4 z-50 w-[min(370px,calc(100vw-2rem))] space-y-2.5"
    >
      {toasts.map((toast) => {
        const active = isTransferActive(toast.phase);
        const completed = toast.phase === 'delivered' || toast.phase === 'ready';
        const failed = toast.phase === 'error';

        return (
          <div
            key={toast.code}
            data-testid={`transfer-toast-${toast.code}`}
            className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl"
          >
            <div
              aria-hidden="true"
              className={`h-[3px] w-full ${
                failed ? 'bg-red-500' : completed ? 'bg-emerald-600' : 'brand-primary-bg'
              }`}
            />

            <div className="p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      completed
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                        : failed
                        ? 'bg-red-50 text-red-700'
                        : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    {toast.mode === 'p2p' ? (
                      <Radio className="h-3.5 w-3.5" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">
                      {formatToastHeadline(toast)}
                    </p>
                    <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                      {formatToastMeta(toast)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`mr-1 font-mono-num text-[12.5px] font-bold ${
                      completed
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : failed
                        ? 'text-red-700'
                        : 'text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    {toast.progress}%
                  </span>
                  <button
                    type="button"
                    aria-label={`Restore transfer ${toast.code}`}
                    title="Restore workspace"
                    onClick={onRestore}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 cursor-pointer"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Dismiss transfer ${toast.code}`}
                    title="Dismiss"
                    onClick={() => onDismiss(toast.code)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div
                role="progressbar"
                aria-label={`Progress for ${formatToastHeadline(toast)}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={toast.progress}
                className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
              >
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    failed ? 'bg-red-500' : completed ? 'bg-emerald-600' : 'brand-primary-bg'
                  }`}
                  style={{
                    width: `${active && toast.progress === 0 ? 12 : toast.progress}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span
                  className={`truncate ${
                    completed
                      ? 'font-medium text-emerald-700 dark:text-emerald-400'
                      : failed
                      ? 'text-red-700'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {toast.statusText}
                </span>

                {toast.shareUrl && (
                  <button
                    type="button"
                    onClick={() => void handleCopy(toast)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {copiedCode === toast.code ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy link
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </aside>
  );
}

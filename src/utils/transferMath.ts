export type Currency = 'INR' | 'USD';
export type TransferMode = 'p2p' | 'server';

export const MAX_DIRECT_BYTES = 20 * 1024 * 1024 * 1024 * 1024; // 20 TB
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB
export const GB_BYTES = 1024 * 1024 * 1024;

export const SLIDER_GB_STOPS = [
  1, 2, 3, 5, 8, 10, 15, 25, 50, 75, 100, 250, 500, 1024, 2048, 5120, 10240, 20480,
] as const;

export const RATES: Record<Currency, { p2p: number; server: number; minCard: number }> = {
  INR: { p2p: 1, server: 2, minCard: 1 },
  USD: { p2p: 0.05, server: 0.1, minCard: 0.5 },
};

const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.msi',
  '.scr',
  '.pif',
  '.com',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.ps1',
  '.psm1',
  '.sh',
  '.dll',
  '.sys',
  '.drv',
  '.docm',
  '.xlsm',
  '.pptm',
  '.app',
  '.dmg',
  '.apk',
  '.jar',
]);

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  const decimals = unitIdx <= 1 ? 0 : value >= 100 ? 0 : 1;
  return `${Number(value.toFixed(decimals))} ${units[unitIdx]}`;
}

export function formatGbDisplay(gb: number): { value: string; unit: 'GB' | 'TB' } {
  if (gb >= 1024) {
    const tb = gb / 1024;
    return { value: Number.isInteger(tb) ? String(tb) : tb.toFixed(1), unit: 'TB' };
  }
  return { value: String(gb), unit: 'GB' };
}

export function computeBilledGb(totalBytes: number): number {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return 1;
  return Math.max(1, Math.ceil(totalBytes / GB_BYTES));
}

export interface PriceQuote {
  billedGb: number;
  amount: number;
  formatted: string;
  perGbFormatted: string;
  isMinimumApplied: boolean;
  gatewayLabel: string;
}

export function calculatePrice(
  billedGb: number,
  mode: TransferMode,
  currency: Currency
): PriceQuote {
  const safeGb = Math.max(1, Math.ceil(billedGb));
  const rateInfo = RATES[currency];
  const rate = mode === 'p2p' ? rateInfo.p2p : rateInfo.server;
  const rawAmount = Number((safeGb * rate).toFixed(2));
  const amount = Math.max(rateInfo.minCard, rawAmount);
  const isMinimumApplied = rawAmount < rateInfo.minCard;

  if (currency === 'INR') {
    const formatted = Number.isInteger(amount) ? `₹${amount}` : `₹${amount.toFixed(2)}`;
    return {
      billedGb: safeGb,
      amount,
      formatted,
      perGbFormatted: `₹${rate}/GB`,
      isMinimumApplied,
      gatewayLabel: 'Razorpay · UPI or card',
    };
  }

  const formatted = `$${amount.toFixed(2)}`;
  return {
    billedGb: safeGb,
    amount,
    formatted,
    perGbFormatted: `$${rate.toFixed(2)}/GB`,
    isMinimumApplied,
    gatewayLabel: 'Stripe · cards',
  };
}

export function formatCompactPrice(amount: number, currency: Currency): string {
  if (currency === 'INR') {
    return Number.isInteger(amount) ? `₹${amount}` : `₹${amount.toFixed(2)}`;
  }
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function sliderIndexToGb(index: number): number {
  const clamped = Math.max(0, Math.min(SLIDER_GB_STOPS.length - 1, Math.round(index)));
  return SLIDER_GB_STOPS[clamped];
}

export interface FileSafetyResult {
  allowed: boolean;
  blockedFiles: string[];
  reason: string | null;
}

export function screenFileNames(fileNames: string[]): FileSafetyResult {
  const blockedFiles: string[] = [];
  for (const name of fileNames) {
    const lower = name.trim().toLowerCase();
    const dotIdx = lower.lastIndexOf('.');
    if (dotIdx !== -1) {
      const ext = lower.slice(dotIdx);
      if (BLOCKED_EXTENSIONS.has(ext)) {
        blockedFiles.push(name);
      }
    }
  }
  if (blockedFiles.length > 0) {
    return {
      allowed: false,
      blockedFiles,
      reason: `Executable, script, or macro files are refused (${blockedFiles.slice(0, 2).join(', ')}).`,
    };
  }
  return { allowed: true, blockedFiles: [], reason: null };
}

export function generateTransferCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

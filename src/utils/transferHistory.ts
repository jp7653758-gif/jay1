import { Currency, formatCompactPrice, TransferMode } from './transferMath';

export type PaymentRegion = 'IN' | 'GLOBAL';
export type PaymentGateway = 'razorpay' | 'stripe';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';
export type PayerRole = 'sender' | 'receiver';
export type PaymentStatus = 'paid' | 'pending_receiver';
export type TransferLifecycleStatus =
  | 'ready'
  | 'uploading'
  | 'streaming'
  | 'delivered'
  | 'deleted';

export interface SavedPaymentMethod {
  id: string;
  ownerUid: string;
  label: string;
  region: PaymentRegion;
  gateway: PaymentGateway;
  method: PaymentMethod;
  detail: string;
  isDefault: boolean;
  createdAtMs: number;
}

export interface TransferHistoryEntry {
  code: string;
  ownerUid: string;
  headline: string;
  fileCount: number;
  totalBytes: number;
  billedGb: number;
  mode: TransferMode;
  destination: string;
  currency: Currency;
  priceAmount: number;
  priceFormatted: string;
  paymentGateway: PaymentGateway;
  paymentMethod: PaymentMethod;
  payerRole: PayerRole;
  paymentStatus: PaymentStatus;
  status: TransferLifecycleStatus;
  shareUrl: string;
  createdAtMs: number;
}

export interface PaymentSelection {
  region: PaymentRegion;
  gateway: PaymentGateway;
  method: PaymentMethod;
  currency: Currency;
}

export const REGION_PAYMENT_METHODS: Record<
  PaymentRegion,
  Array<{ id: PaymentMethod; label: string; subtitle: string; placeholder: string }>
> = {
  IN: [
    {
      id: 'upi',
      label: 'UPI',
      subtitle: 'GPay, PhonePe, Paytm, BHIM via Razorpay',
      placeholder: 'name@okaxis',
    },
    {
      id: 'card',
      label: 'Card',
      subtitle: 'RuPay, Visa, Mastercard via Razorpay',
      placeholder: 'HDFC Visa •••• 4821',
    },
    {
      id: 'netbanking',
      label: 'NetBanking',
      subtitle: 'HDFC, ICICI, SBI, Axis via Razorpay',
      placeholder: 'ICICI Corporate NetBanking',
    },
  ],
  GLOBAL: [
    {
      id: 'card',
      label: 'Card',
      subtitle: 'International Visa, Mastercard, Amex via Stripe',
      placeholder: 'Stripe Visa •••• 4242',
    },
    {
      id: 'wallet',
      label: 'Digital Wallet',
      subtitle: 'Apple Pay, Google Pay, Link via Stripe',
      placeholder: 'Google Pay · Global USD',
    },
  ],
};

export function resolvePaymentSelection(
  region: PaymentRegion,
  requestedMethod: PaymentMethod
): PaymentSelection {
  if (region === 'IN') {
    const allowed: PaymentMethod[] = ['upi', 'card', 'netbanking'];
    return {
      region: 'IN',
      gateway: 'razorpay',
      method: allowed.includes(requestedMethod) ? requestedMethod : 'upi',
      currency: 'INR',
    };
  }
  const allowedGlobal: PaymentMethod[] = ['card', 'wallet'];
  return {
    region: 'GLOBAL',
    gateway: 'stripe',
    method: allowedGlobal.includes(requestedMethod) ? requestedMethod : 'card',
    currency: 'USD',
  };
}

export function formatMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'upi':
      return 'UPI';
    case 'netbanking':
      return 'NetBanking';
    case 'wallet':
      return 'Wallet';
    default:
      return 'Card';
  }
}

export function validatePaymentMethodInput(input: {
  label: string;
  region: PaymentRegion;
  method: PaymentMethod;
  detail: string;
}): { ok: true; label: string; detail: string; selection: PaymentSelection } | { ok: false; error: string } {
  const label = input.label.trim().slice(0, 60);
  const detail = input.detail.trim().slice(0, 120);

  if (label.length < 2) {
    return { ok: false, error: 'Give this payment method a short name (at least 2 characters).' };
  }

  const selection = resolvePaymentSelection(input.region, input.method);

  if (selection.method === 'upi') {
    if (!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9.-]{2,}$/.test(detail)) {
      return { ok: false, error: 'Enter a valid UPI ID such as name@okaxis or mobile@ybl.' };
    }
  } else if (detail.length < 3) {
    return { ok: false, error: 'Enter a brief bank, card last-4, or wallet reference.' };
  }

  return { ok: true, label, detail, selection };
}

export function deriveDestination(
  customDestination: string,
  mode: TransferMode,
  payerRole: PayerRole
): string {
  const trimmed = customDestination.trim().slice(0, 180);
  if (trimmed.length > 0) return trimmed;
  if (mode === 'p2p') {
    return payerRole === 'receiver'
      ? 'Direct P2P · Receiver pays on open'
      : 'Direct P2P · Device-to-device';
  }
  return payerRole === 'receiver'
    ? '7-day vault · Receiver pays'
    : '7-day vault · Encrypted link';
}

export function formatPaymentSummary(
  gateway: PaymentGateway,
  method: PaymentMethod,
  payerRole: PayerRole,
  paymentStatus: PaymentStatus
): string {
  const provider = `${gateway === 'razorpay' ? 'Razorpay' : 'Stripe'} · ${formatMethodLabel(method)}`;

  if (payerRole === 'receiver') {
    return paymentStatus === 'paid'
      ? `Receiver paid · ${provider}`
      : `Receiver pays · ${provider}`;
  }
  return `Paid · ${provider}`;
}

export type HistoryFilter = 'all' | 'p2p' | 'server' | 'receiver_pays';

export function filterTransferHistory(
  items: TransferHistoryEntry[],
  filter: HistoryFilter,
  searchQuery: string
): TransferHistoryEntry[] {
  const q = searchQuery.trim().toLowerCase();
  return items.filter((item) => {
    if (item.status === 'deleted') return false;
    if (filter === 'p2p' && item.mode !== 'p2p') return false;
    if (filter === 'server' && item.mode !== 'server') return false;
    if (filter === 'receiver_pays' && item.payerRole !== 'receiver') return false;

    if (!q) return true;
    return (
      item.headline.toLowerCase().includes(q) ||
      item.destination.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q)
    );
  });
}

export interface HistorySummary {
  totalTransfers: number;
  totalBytes: number;
  totalBilledGb: number;
  costSummaryLabel: string;
}

export function summarizeTransferHistory(items: TransferHistoryEntry[]): HistorySummary {
  const active = items.filter((item) => item.status !== 'deleted');
  let totalBytes = 0;
  let totalBilledGb = 0;
  let usdTotal = 0;
  let inrTotal = 0;

  for (const item of active) {
    totalBytes += item.totalBytes;
    totalBilledGb += item.billedGb;
    if (item.currency === 'INR') {
      inrTotal += item.priceAmount;
    } else {
      usdTotal += item.priceAmount;
    }
  }

  const parts: string[] = [];
  if (usdTotal > 0) parts.push(formatCompactPrice(Number(usdTotal.toFixed(2)), 'USD'));
  if (inrTotal > 0) parts.push(formatCompactPrice(Number(inrTotal.toFixed(2)), 'INR'));
  const costSummaryLabel = parts.length > 0 ? parts.join(' + ') : '$0.00';

  return {
    totalTransfers: active.length,
    totalBytes,
    totalBilledGb,
    costSummaryLabel,
  };
}

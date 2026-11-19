import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import {
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  HardDrive,
  History,
  Landmark,
  LogOut,
  MapPin,
  Phone,
  Plus,
  Search,
  Smartphone,
  Star,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { formatBytes } from '../utils/transferMath';
import {
  filterTransferHistory,
  formatMethodLabel,
  formatPaymentSummary,
  HistoryFilter,
  PaymentMethod,
  PaymentRegion,
  REGION_PAYMENT_METHODS,
  SavedPaymentMethod,
  summarizeTransferHistory,
  TransferHistoryEntry,
  validatePaymentMethodInput,
} from '../utils/transferHistory';
import { PWAInstallButton } from './PWAInstallButton';

export interface AccountUser {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId?: string;
}

interface AccountModalProps {
  open: boolean;
  initialTab: 'transfers' | 'payments';
  user: AccountUser | null;
  authReady: boolean;
  historyEntries: TransferHistoryEntry[];
  historyLoading: boolean;
  historyError: string | null;
  paymentMethods: SavedPaymentMethod[];
  paymentsLoading: boolean;
  paymentsError: string | null;
  onClose: () => void;
  onGoogleSignIn: () => Promise<void>;
  onInitRecaptcha: (el: HTMLElement) => RecaptchaVerifier;
  onSendPhoneOtp: (phoneE164: string, recaptcha: RecaptchaVerifier) => Promise<ConfirmationResult>;
  onFormatAuthError: (err: unknown) => string;
  onLogout: () => Promise<void>;
  onDeleteHistoryEntry: (code: string) => Promise<void>;
  onAddPaymentMethod: (input: {
    label: string;
    region: PaymentRegion;
    method: PaymentMethod;
    detail: string;
    isDefault: boolean;
  }) => Promise<void>;
  onSetDefaultPaymentMethod: (id: string) => Promise<void>;
  onDeletePaymentMethod: (id: string) => Promise<void>;
}

const FILTER_OPTIONS: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'p2p', label: 'Direct' },
  { id: 'server', label: 'Vault' },
  { id: 'receiver_pays', label: 'Receiver pays' },
];

const COUNTRY_CODES = [
  { code: '+91', label: '+91 India' },
  { code: '+1', label: '+1 US / CA' },
  { code: '+44', label: '+44 UK' },
  { code: '+971', label: '+971 UAE' },
  { code: '+65', label: '+65 SG' },
  { code: '+61', label: '+61 AU' },
] as const;

function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
  if (method === 'upi') return <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
  if (method === 'netbanking')
    return <Landmark className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
  if (method === 'wallet') return <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
  return <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
}

export function AccountModal({
  open,
  initialTab,
  user,
  authReady,
  historyEntries,
  historyLoading,
  historyError,
  paymentMethods,
  paymentsLoading,
  paymentsError,
  onClose,
  onGoogleSignIn,
  onInitRecaptcha,
  onSendPhoneOtp,
  onFormatAuthError,
  onLogout,
  onDeleteHistoryEntry,
  onAddPaymentMethod,
  onSetDefaultPaymentMethod,
  onDeletePaymentMethod,
}: AccountModalProps) {
  const [authTab, setAuthTab] = useState<'google' | 'otp'>('google');
  const [accountTab, setAccountTab] = useState<'transfers' | 'payments'>(initialTab);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Phone OTP state
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaBoxRef = useRef<HTMLDivElement | null>(null);
  const recaptchaInstanceRef = useRef<RecaptchaVerifier | null>(null);

  // Transfer History filters
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  // Add Payment Method form state
  const [pmRegion, setPmRegion] = useState<PaymentRegion>('IN');
  const [pmMethod, setPmMethod] = useState<PaymentMethod>('upi');
  const [pmLabel, setPmLabel] = useState('');
  const [pmDetail, setPmDetail] = useState('');
  const [pmDefault, setPmDefault] = useState(true);
  const [pmSaving, setPmSaving] = useState(false);
  const [pmError, setPmError] = useState<string | null>(null);
  const [pmDeletingId, setPmDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setAccountTab(initialTab);
  }, [initialTab, open]);

  useEffect(() => {
    return () => {
      recaptchaInstanceRef.current?.clear();
      recaptchaInstanceRef.current = null;
    };
  }, []);

  const summary = useMemo(() => summarizeTransferHistory(historyEntries), [historyEntries]);
  const filteredEntries = useMemo(
    () => filterTransferHistory(historyEntries, filter, searchQuery),
    [historyEntries, filter, searchQuery]
  );

  if (!open) return null;

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await onGoogleSignIn();
    } catch (err) {
      setAuthError(onFormatAuthError(err));
    } finally {
      setSigningIn(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const digitsOnly = phoneDigits.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 14) {
      setAuthError('Enter a valid mobile number without spaces or leading zeros.');
      return;
    }
    const fullPhone = `${countryCode}${digitsOnly}`;

    setSigningIn(true);
    setAuthError(null);
    try {
      if (!recaptchaInstanceRef.current && recaptchaBoxRef.current) {
        recaptchaInstanceRef.current = onInitRecaptcha(recaptchaBoxRef.current);
      }
      if (!recaptchaInstanceRef.current) {
        throw new Error('Verification container is not ready yet.');
      }
      const conf = await onSendPhoneOtp(fullPhone, recaptchaInstanceRef.current);
      setConfirmation(conf);
    } catch (err) {
      recaptchaInstanceRef.current?.clear();
      recaptchaInstanceRef.current = null;
      setAuthError(onFormatAuthError(err));
    } finally {
      setSigningIn(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    if (otpCode.trim().length < 6) {
      setAuthError('Enter the 6-digit OTP sent via SMS.');
      return;
    }

    setSigningIn(true);
    setAuthError(null);
    try {
      await confirmation.confirm(otpCode.trim());
      setConfirmation(null);
      setOtpCode('');
      setPhoneDigits('');
    } catch (err) {
      setAuthError(onFormatAuthError(err));
    } finally {
      setSigningIn(false);
    }
  };

  const handleCopy = async (entry: TransferHistoryEntry) => {
    await navigator.clipboard.writeText(entry.shareUrl);
    setCopiedCode(entry.code);
    window.setTimeout(() => setCopiedCode((c) => (c === entry.code ? null : c)), 1600);
  };

  const handleDeleteTransfer = async (code: string) => {
    setDeletingCode(code);
    try {
      await onDeleteHistoryEntry(code);
    } finally {
      setDeletingCode(null);
    }
  };

  const handleSavePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setPmError(null);
    const check = validatePaymentMethodInput({
      label: pmLabel,
      region: pmRegion,
      method: pmMethod,
      detail: pmDetail,
    });
    if (!check.ok) {
      setPmError(check.error);
      return;
    }

    setPmSaving(true);
    try {
      await onAddPaymentMethod({
        label: check.label,
        region: check.selection.region,
        method: check.selection.method,
        detail: check.detail,
        isDefault: pmDefault,
      });
      setPmLabel('');
      setPmDetail('');
    } catch (err) {
      setPmError(err instanceof Error ? err.message : 'Unable to save payment method.');
    } finally {
      setPmSaving(false);
    }
  };

  const activeRegionCatalog = REGION_PAYMENT_METHODS[pmRegion];
  const selectedMethodMeta =
    activeRegionCatalog.find((item) => item.id === pmMethod) || activeRegionCatalog[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={user ? 'Account, Transfer History & Payment Methods' : 'Sign in to Share by Jalpi'}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs"
    >
      <div className="w-full sm:max-w-[720px] max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-2xl overflow-hidden">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700 sm:hidden" />

        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0 gap-3">
          <div>
            <h2 className="font-display text-[20px] sm:text-[22px] font-bold text-slate-900 dark:text-slate-50">
              {user ? 'Account Workspace' : 'Sign in'}
            </h2>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">
              {user
                ? 'Transfer History and Payment Methods synced across web and phone'
                : 'Use your Google ID or Google Phone OTP to sync transfers and saved cards/UPI'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PWAInstallButton compact />
            <button
              type="button"
              aria-label="Close modal"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!user ? (
          <div className="mt-5 space-y-5 overflow-y-auto pr-1">
            {/* Auth Method Switcher */}
            <div
              role="tablist"
              aria-label="Sign-in options"
              className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'google'}
                onClick={() => {
                  setAuthTab('google');
                  setAuthError(null);
                }}
                className={`min-h-[44px] rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors cursor-pointer ${
                  authTab === 'google'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Google ID
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'otp'}
                onClick={() => {
                  setAuthTab('otp');
                  setAuthError(null);
                }}
                className={`min-h-[44px] rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors cursor-pointer ${
                  authTab === 'otp'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Google Phone OTP
              </button>
            </div>

            {authError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 px-3.5 py-2.5 text-[13px] text-red-700 dark:text-red-300"
              >
                {authError}
              </div>
            )}

            {authTab === 'google' ? (
              <div className="space-y-4">
                <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                  Sign in instantly with your Google account. Your Transfer History and saved
                  payment methods stay synced between desktop and phone.
                </p>

                <button
                  type="button"
                  disabled={!authReady || signingIn}
                  onClick={() => void handleGoogleLogin()}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-[14.5px] font-semibold text-slate-900 dark:text-white shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                    <path
                      fill="#4285F4"
                      d="M23.52 12.27c0-.85-.08-1.68-.22-2.48H12v4.69h6.46a5.52 5.52 0 0 1-2.39 3.62v3.01h3.87c2.26-2.08 3.58-5.15 3.58-8.84z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3.01c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.29a7.18 7.18 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4-3.1z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.61l4 3.1C6.23 6.86 8.88 4.75 12 4.75z"
                    />
                  </svg>
                  <span>{signingIn ? 'Opening Google Sign-In…' : 'Continue with Google'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                  Verify your mobile number with a Google Firebase 6-digit SMS OTP.
                </p>

                {!confirmation ? (
                  <form onSubmit={(e) => void handleSendOtp(e)} className="space-y-3">
                    <div className="grid grid-cols-[128px_1fr] gap-2">
                      <label htmlFor="otp-country-code" className="sr-only">
                        Country code
                      </label>
                      <select
                        id="otp-country-code"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-[13.5px] font-medium text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>

                      <div>
                        <label htmlFor="otp-phone-number" className="sr-only">
                          Mobile number
                        </label>
                        <input
                          id="otp-phone-number"
                          type="tel"
                          inputMode="tel"
                          value={phoneDigits}
                          onChange={(e) => setPhoneDigits(e.target.value)}
                          placeholder="9876543210"
                          className="min-h-[46px] w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-[14px] font-mono-num text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!authReady || signingIn}
                      className="brand-cta w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14.5px] font-semibold text-white cursor-pointer disabled:opacity-60"
                    >
                      <Phone className="h-4 w-4" />
                      <span>{signingIn ? 'Sending OTP…' : 'Send OTP Code'}</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={(e) => void handleVerifyOtp(e)} className="space-y-3">
                    <div>
                      <label
                        htmlFor="otp-verify-input"
                        className="block text-[12.5px] font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                      >
                        Enter 6-digit OTP sent to {countryCode} {phoneDigits}
                      </label>
                      <input
                        id="otp-verify-input"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="min-h-[48px] w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-center font-mono-num text-[18px] tracking-[0.25em] font-bold text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmation(null);
                          setOtpCode('');
                        }}
                        className="min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 px-4 text-[13.5px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        Change number
                      </button>
                      <button
                        type="submit"
                        disabled={signingIn}
                        className="brand-cta flex-1 min-h-[46px] rounded-xl px-5 text-[14.5px] font-semibold text-white cursor-pointer disabled:opacity-60"
                      >
                        {signingIn ? 'Verifying…' : 'Verify OTP & Sign in'}
                      </button>
                    </div>
                  </form>
                )}

                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Phone OTP uses Firebase Authentication (enable Authentication &gt; Sign-in
                  method &gt; Phone in Firebase Console if not yet active).
                </p>
                <div ref={recaptchaBoxRef} />
              </div>
            )}

            <p className="text-[12px] text-slate-500 dark:text-slate-400 text-center pt-1">
              Sending quickly? Guest transfers remain available without signing in.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
            {/* Authenticated Profile Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2.5 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 rounded-full border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-700 text-[13px] font-bold text-white">
                    {(user.displayName || user.email || user.phoneNumber || 'U')
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-white">
                    {user.displayName || user.email || user.phoneNumber}
                  </p>
                  <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">
                    {user.email || user.phoneNumber}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void onLogout()}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>

            {/* Workspace Sub-Navigation */}
            <div
              role="tablist"
              aria-label="Account sections"
              className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1 shrink-0"
            >
              <button
                type="button"
                role="tab"
                aria-selected={accountTab === 'transfers'}
                onClick={() => setAccountTab('transfers')}
                className={`min-h-[40px] inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                  accountTab === 'transfers'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <History className="h-4 w-4" />
                <span>Transfer History ({summary.totalTransfers})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={accountTab === 'payments'}
                onClick={() => setAccountTab('payments')}
                className={`min-h-[40px] inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                  accountTab === 'payments'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <span>Payment Methods ({paymentMethods.length})</span>
              </button>
            </div>

            {accountTab === 'transfers' ? (
              <section
                aria-labelledby="transfer-history-heading"
                className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden"
              >
                <h3 id="transfer-history-heading" className="sr-only">
                  Transfer History
                </h3>

                {/* Summary Strip */}
                <div className="grid grid-cols-3 gap-2.5 shrink-0">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5">
                    <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                      Transfers
                    </p>
                    <p className="mt-0.5 font-mono-num text-[17px] font-bold text-slate-900 dark:text-white">
                      {summary.totalTransfers}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5">
                    <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                      Total volume
                    </p>
                    <p className="mt-0.5 font-mono-num text-[17px] font-bold text-slate-900 dark:text-white">
                      {formatBytes(summary.totalBytes)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5">
                    <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                      Total cost
                    </p>
                    <p className="mt-0.5 font-mono-num text-[17px] font-bold text-blue-700 dark:text-blue-400 truncate">
                      {summary.costSummaryLabel}
                    </p>
                  </div>
                </div>

                {/* Filters + Search */}
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <div
                    role="group"
                    aria-label="Filter transfer history"
                    className="flex flex-wrap gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1"
                  >
                    {FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={filter === opt.id}
                        onClick={() => setFilter(opt.id)}
                        className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                          filter === opt.id
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
                    />
                    <input
                      type="search"
                      aria-label="Search transfer history"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter by file, destination, or code…"
                      className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-[13px] text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                {historyError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-3.5 py-2 text-[12.5px] text-red-700 dark:text-red-300 shrink-0"
                  >
                    {historyError}
                  </div>
                )}

                {/* History List */}
                {historyLoading ? (
                  <p className="py-6 text-center text-[14px] text-slate-500 dark:text-slate-400">
                    Loading Transfer History…
                  </p>
                ) : filteredEntries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-[13.5px] text-slate-500 dark:text-slate-400">
                    {historyEntries.length === 0
                      ? 'No transfers recorded under this account yet. Send or upload files to record your first delivery.'
                      : 'No transfers match your current filter.'}
                  </div>
                ) : (
                  <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    {filteredEntries.map((entry) => (
                      <li
                        key={entry.code}
                        data-testid={`history-row-${entry.code}`}
                        className="px-4 py-3.5 space-y-2 hover:bg-slate-50/70 dark:hover:bg-slate-900/60 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-bold text-slate-900 dark:text-white">
                              {entry.headline}
                            </p>
                            <p className="mt-0.5 font-mono-num text-[11.5px] text-slate-500 dark:text-slate-400">
                              #{entry.code} · {entry.status} ·{' '}
                              {entry.mode === 'p2p' ? 'Direct P2P' : '7-day Vault'} ·{' '}
                              {new Date(entry.createdAtMs).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="font-mono-num text-[15px] font-extrabold text-slate-900 dark:text-white">
                              {entry.priceFormatted}
                            </p>
                            <p className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-600 dark:text-slate-400">
                              <PaymentMethodIcon method={entry.paymentMethod} />
                              {formatPaymentSummary(
                                entry.paymentGateway,
                                entry.paymentMethod,
                                entry.payerRole,
                                entry.paymentStatus
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[12px]">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300">
                            <span className="inline-flex items-center gap-1 font-mono-num">
                              <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                              <span>
                                Size:{' '}
                                <strong className="text-slate-900 dark:text-white">
                                  {formatBytes(entry.totalBytes)}
                                </strong>{' '}
                                ({entry.billedGb} GB billed)
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              <span>
                                Destination:{' '}
                                <strong className="text-slate-900 dark:text-white">
                                  {entry.destination}
                                </strong>
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleCopy(entry)}
                              className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11.5px] font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              {copiedCode === entry.code ? (
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
                            <a
                              href={`/?t=${entry.code}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open link for ${entry.code}`}
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              disabled={deletingCode === entry.code}
                              aria-label={`Delete transfer ${entry.code}`}
                              onClick={() => void handleDeleteTransfer(entry.code)}
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              /* Payment Methods Section */
              <section
                aria-labelledby="payment-methods-heading"
                className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto pr-1"
              >
                <h3 id="payment-methods-heading" className="sr-only">
                  Saved Payment Methods
                </h3>

                {paymentsError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-3.5 py-2 text-[12.5px] text-red-700 dark:text-red-300"
                  >
                    {paymentsError}
                  </div>
                )}

                {paymentsLoading ? (
                  <p className="py-4 text-center text-[13.5px] text-slate-500 dark:text-slate-400">
                    Loading payment methods…
                  </p>
                ) : paymentMethods.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-[13px] text-slate-500 dark:text-slate-400">
                    No saved payment methods yet. Add UPI, Card, NetBanking, or Wallet below for
                    faster checkout.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    {paymentMethods.map((pm) => (
                      <li
                        key={pm.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                            <PaymentMethodIcon method={pm.method} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-bold text-slate-900 dark:text-white">
                              {pm.label}
                              {pm.isDefault && (
                                <span className="ml-2 font-mono-num text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                  · Default
                                </span>
                              )}
                            </p>
                            <p className="truncate font-mono-num text-[12px] text-slate-500 dark:text-slate-400">
                              {pm.gateway === 'razorpay' ? 'Razorpay' : 'Stripe'} ·{' '}
                              {formatMethodLabel(pm.method)} · {pm.detail}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!pm.isDefault && (
                            <button
                              type="button"
                              onClick={() => void onSetDefaultPaymentMethod(pm.id)}
                              className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Star className="h-3 w-3" />
                              Set default
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={pmDeletingId === pm.id}
                            aria-label={`Remove ${pm.label}`}
                            onClick={() => {
                              setPmDeletingId(pm.id);
                              void onDeletePaymentMethod(pm.id).finally(() =>
                                setPmDeletingId(null)
                              );
                            }}
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add Payment Method Form */}
                <form
                  onSubmit={(e) => void handleSavePaymentMethod(e)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-[14px] font-bold text-slate-900 dark:text-white">
                      Add payment method
                    </h4>
                    <div
                      role="group"
                      aria-label="Billing region"
                      className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-[11.5px] font-semibold"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPmRegion('IN');
                          setPmMethod('upi');
                        }}
                        className={`rounded-md px-2.5 py-1 cursor-pointer ${
                          pmRegion === 'IN'
                            ? 'bg-blue-700 text-white'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        India · ₹
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPmRegion('GLOBAL');
                          setPmMethod('card');
                        }}
                        className={`rounded-md px-2.5 py-1 cursor-pointer ${
                          pmRegion === 'GLOBAL'
                            ? 'bg-blue-700 text-white'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Global · $
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {activeRegionCatalog.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPmMethod(m.id)}
                        className={`min-h-[38px] rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                          pmMethod === m.id
                            ? 'border-blue-700 bg-blue-700 text-white'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="pm-label-input" className="sr-only">
                        Payment label
                      </label>
                      <input
                        id="pm-label-input"
                        type="text"
                        maxLength={60}
                        value={pmLabel}
                        onChange={(e) => setPmLabel(e.target.value)}
                        placeholder="Label (e.g. Studio GPay UPI)"
                        className="min-h-[42px] w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-[13px] text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="pm-detail-input" className="sr-only">
                        Payment handle or detail
                      </label>
                      <input
                        id="pm-detail-input"
                        type="text"
                        maxLength={120}
                        value={pmDetail}
                        onChange={(e) => setPmDetail(e.target.value)}
                        placeholder={selectedMethodMeta.placeholder}
                        className="min-h-[42px] w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 font-mono-num text-[13px] text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pmDefault}
                      onChange={(e) => setPmDefault(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span>Make this my default checkout method</span>
                  </label>

                  {pmError && (
                    <p role="alert" className="text-[12px] text-red-600 dark:text-red-400">
                      {pmError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={pmSaving}
                    className="brand-cta w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold text-white cursor-pointer disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{pmSaving ? 'Saving…' : 'Save payment method'}</span>
                  </button>
                </form>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function LegalModal({
  doc,
  onClose,
}: {
  doc: 'privacy' | 'terms' | 'refunds' | null;
  onClose: () => void;
}) {
  if (!doc) return null;

  const content = {
    privacy: {
      title: 'Privacy Policy',
      body: 'Direct (P2P) transfers move directly between sender and receiver devices over DTLS-encrypted WebRTC data channels without touching storage. Vault uploads are scanned for malware, stored encrypted for 7 days, and purged upon expiry or manual deletion.',
    },
    terms: {
      title: 'Terms of Service',
      body: 'Share by Jalpi provides metered per-GB P2P delivery (up to 20 TB) and temporary vault hosting (up to 50 GB). Executable binaries, scripts, and macro documents are blocked automatically to safeguard recipients.',
    },
    refunds: {
      title: 'Refunds & Cancellations',
      body: 'Dropped Direct transfers automatically resume from the last acknowledged byte without double billing. Unused vault uploads cancelled early are credited per gigabyte.',
    },
  }[doc];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={content.title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs"
    >
      <div className="w-full sm:max-w-[480px] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2 className="font-display text-[20px] font-bold text-slate-900 dark:text-white">
            {content.title}
          </h2>
          <button
            type="button"
            aria-label="Close legal dialog"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">
          {content.body}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="brand-cta w-full min-h-[44px] rounded-xl py-2.5 text-[14px] font-semibold text-white cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}

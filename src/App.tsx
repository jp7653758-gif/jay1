import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { CreditCard, Folder, Lock, RefreshCw } from 'lucide-react';
import { AccountModal, AccountUser, LegalModal } from './components/AccountModal';
import { Header } from './components/Header';
import { LandingSections } from './components/LandingSections';
import { MobileBottomNav, MobileNavTab } from './components/MobileBottomNav';
import { PricingAndBottom } from './components/PricingAndBottom';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ReceiverView } from './components/ReceiverView';
import { SendWorkbench } from './components/SendWorkbench';
import { TransferToastContainer } from './components/TransferToastContainer';
import {
  addSavedPaymentMethod,
  auth,
  createPhoneRecaptcha,
  deleteSavedPaymentMethod,
  deleteTransferHistoryRecord,
  ensureUserProfile,
  formatFirebaseAuthError,
  SaveTransferHistoryInput,
  saveTransferToHistory,
  sendPhoneOtp,
  setDefaultPaymentMethod,
  signInWithGoogle,
  signOutUser,
  subscribeToPaymentMethods,
  subscribeToTransferHistory,
  updateTransferHistoryStatus,
} from './firebase';
import { Currency } from './utils/transferMath';
import {
  PaymentMethod,
  PaymentRegion,
  resolvePaymentSelection,
  SavedPaymentMethod,
  TransferHistoryEntry,
  TransferLifecycleStatus,
} from './utils/transferHistory';
import {
  ActiveTransferToast,
  dismissTransferToast,
  getVisibleTransferToasts,
  removeTransferToast,
  reopenAllTransferToasts,
  upsertTransferToast,
} from './utils/transferToasts';

export default function App() {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('jalpishare_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  const [authUser, setAuthUser] = useState<AccountUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [historyEntries, setHistoryEntries] = useState<TransferHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const [workbenchMode, setWorkbenchMode] = useState<'demo' | 'send'>('demo');
  const [workbenchMinimized, setWorkbenchMinimized] = useState(false);
  const [transferToasts, setTransferToasts] = useState<ActiveTransferToast[]>([]);
  const [pickerSignal, setPickerSignal] = useState(0);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState<'transfers' | 'payments'>('transfers');
  const [mobileNavTab, setMobileNavTab] = useState<MobileNavTab>('send');
  const [legalDoc, setLegalDoc] = useState<'privacy' | 'terms' | 'refunds' | null>(null);

  const [receiverCode, setReceiverCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const tParam = params.get('t');
    if (tParam) return tParam;
    const match = window.location.pathname.match(/^\/t\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      window.localStorage.setItem('jalpishare_theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage errors
    }
  }, [darkMode]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const mapped: AccountUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          phoneNumber: fbUser.phoneNumber,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
          providerId: fbUser.providerData?.[0]?.providerId,
        };
        setAuthUser(mapped);
        setAuthReady(true);
        try {
          await ensureUserProfile(fbUser, currency);
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      } else {
        setAuthUser(null);
        setHistoryEntries([]);
        setHistoryLoading(false);
        setHistoryError(null);
        setPaymentMethods([]);
        setPaymentsLoading(false);
        setPaymentsError(null);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !authUser) return;
    setHistoryLoading(true);
    setHistoryError(null);
    const unsub = subscribeToTransferHistory(
      authUser.uid,
      (entries) => {
        setHistoryEntries(entries);
        setHistoryLoading(false);
      },
      (err) => {
        setHistoryError(err.message);
        setHistoryLoading(false);
      }
    );
    return () => unsub();
  }, [authReady, authUser]);

  useEffect(() => {
    if (!authReady || !authUser) return;
    setPaymentsLoading(true);
    setPaymentsError(null);
    const unsub = subscribeToPaymentMethods(
      authUser.uid,
      (methods) => {
        setPaymentMethods(methods);
        setPaymentsLoading(false);
      },
      (err) => {
        setPaymentsError(err.message);
        setPaymentsLoading(false);
      }
    );
    return () => unsub();
  }, [authReady, authUser]);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const tParam = params.get('t');
      if (tParam) {
        setReceiverCode(tParam);
        return;
      }
      const match = window.location.pathname.match(/^\/t\/([A-Za-z0-9_-]+)/);
      setReceiverCode(match ? match[1] : null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleOpenAuth = useCallback((tab: 'transfers' | 'payments' = 'transfers') => {
    setAccountModalTab(tab);
    setAuthModalOpen(true);
  }, []);

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleLogout = async () => {
    await signOutUser();
  };

  const handleAddPaymentMethod = useCallback(
    async (input: {
      label: string;
      region: PaymentRegion;
      method: PaymentMethod;
      detail: string;
      isDefault: boolean;
    }) => {
      if (!authUser) throw new Error('Sign in to save payment methods.');
      const selection = resolvePaymentSelection(input.region, input.method);
      await addSavedPaymentMethod(
        authUser.uid,
        {
          label: input.label,
          region: selection.region,
          gateway: selection.gateway,
          method: selection.method,
          detail: input.detail,
          isDefault: input.isDefault,
        },
        paymentMethods
      );
    },
    [authUser, paymentMethods]
  );

  const handleSetDefaultPaymentMethod = useCallback(
    async (id: string) => {
      if (!authUser) return;
      await setDefaultPaymentMethod(authUser.uid, id, paymentMethods);
    },
    [authUser, paymentMethods]
  );

  const handleDeletePaymentMethod = useCallback(
    async (id: string) => {
      if (!authUser) return;
      await deleteSavedPaymentMethod(authUser.uid, id);
    },
    [authUser]
  );

  const handleTransferRecorded = useCallback(
    (entry: SaveTransferHistoryInput) => {
      if (!authUser) return;
      void saveTransferToHistory(authUser.uid, entry).catch((err) => {
        console.error('Failed to persist transfer history:', err);
      });
    },
    [authUser]
  );

  const handleTransferStatusSync = useCallback(
    (code: string, status: TransferLifecycleStatus) => {
      if (!authUser) return;
      void updateTransferHistoryStatus(authUser.uid, code, status).catch((err) => {
        console.error('Failed to sync transfer status:', err);
      });
    },
    [authUser]
  );

  const handleDeleteHistoryEntry = useCallback(
    async (code: string) => {
      await fetch(`/api/transfers/${code}`, { method: 'DELETE' }).catch(() => {});
      if (authUser) {
        await deleteTransferHistoryRecord(authUser.uid, code);
      }
    },
    [authUser]
  );

  const handleTransferToastUpdate = useCallback((toast: ActiveTransferToast) => {
    setTransferToasts((prev) => upsertTransferToast(prev, toast));
  }, []);

  const handleTransferToastRemove = useCallback((code: string) => {
    setTransferToasts((prev) => removeTransferToast(prev, code));
  }, []);

  const handleMinimizeChange = useCallback((minimized: boolean) => {
    setWorkbenchMinimized(minimized);
    if (minimized) {
      setTransferToasts((prev) => reopenAllTransferToasts(prev));
    }
  }, []);

  const scrollToSend = useCallback((openPicker = false) => {
    setWorkbenchMode('send');
    setWorkbenchMinimized(false);
    setMobileNavTab('send');
    document.getElementById('send')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (openPicker) {
      setPickerSignal((s) => s + 1);
    }
  }, []);

  const handleMobileNavSelect = useCallback(
    (tab: MobileNavTab) => {
      setMobileNavTab(tab);
      if (tab === 'send') {
        if (receiverCode) {
          window.history.pushState({}, '', '/');
          setReceiverCode(null);
        }
        scrollToSend(false);
      } else if (tab === 'history') {
        handleOpenAuth('transfers');
      } else if (tab === 'payments') {
        handleOpenAuth('payments');
      } else {
        handleOpenAuth('transfers');
      }
    },
    [handleOpenAuth, receiverCode, scrollToSend]
  );

  const handleBackHome = () => {
    window.history.pushState({}, '', '/');
    setReceiverCode(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const userLabel = authUser?.email || authUser?.phoneNumber || null;

  const visibleToasts = getVisibleTransferToasts(
    transferToasts,
    workbenchMode === 'send' && workbenchMinimized
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F4F6FA] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 pb-16 md:pb-0 transition-colors">
      <a
        href="#send"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-blue-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to send files
      </a>

      <Header
        userLabel={userLabel}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onOpenAuth={handleOpenAuth}
        onSendClick={() => scrollToSend(false)}
        isReceiverPage={Boolean(receiverCode)}
        onBackHome={handleBackHome}
      />

      {receiverCode ? (
        <ReceiverView code={receiverCode} onBackHome={handleBackHome} />
      ) : (
        <main>
          {/* Hero Section */}
          <section className="studio-grid-surface border-b border-slate-200 dark:border-slate-800">
            <div className="mx-auto max-w-[1200px] px-5 sm:px-8 pt-10 pb-14 sm:pt-14 sm:pb-18 grid gap-10 lg:grid-cols-[1.06fr_0.94fr] items-center">
              {/* Left Hero Copy */}
              <div className="min-w-0">
                <p className="font-mono-num text-[11.5px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">
                  Direct P2P · 7-Day Vault · Installable Phone App
                </p>

                <h1 className="mt-4 font-display text-[42px] sm:text-[62px] lg:text-[70px] font-extrabold leading-[1.02] tracking-[-0.035em] text-slate-900 dark:text-white">
                  Large studio files.
                  <br />
                  Delivered direct,{' '}
                  <span className="brand-accent-text">web or phone.</span>
                </h1>

                <p className="mt-5 max-w-[540px] text-[16.5px] sm:text-[17.5px] leading-[1.6] text-slate-600 dark:text-slate-300">
                  Stream multi-gigabyte builds straight between browsers with zero server storage, or
                  upload once to a 7-day encrypted vault. Sign in with Google ID or Phone OTP and
                  pay per GB with UPI, cards, NetBanking, or wallets.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => scrollToSend(true)}
                    className="brand-cta min-h-[46px] rounded-xl px-6 py-3 text-[15px] font-semibold text-white cursor-pointer"
                  >
                    Choose files to send
                  </button>
                  <PWAInstallButton />
                  <a
                    href="#delivery"
                    className="min-h-[46px] inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 text-[14.5px] font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Explore delivery
                  </a>
                </div>

                <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                  <li className="inline-flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    <span>DTLS encrypted streams</span>
                  </li>
                  <li className="inline-flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    <span>UPI · Card · NetBanking · Wallet</span>
                  </li>
                  <li className="inline-flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    <span>Google ID &amp; Phone OTP</span>
                  </li>
                  <li className="inline-flex items-center gap-2">
                    <Folder className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    <span>Up to 20 TB P2P</span>
                  </li>
                </ul>
              </div>

              {/* Right Interactive Workbench */}
              <SendWorkbench
                currency={currency}
                onCurrencyChange={setCurrency}
                userLabel={userLabel}
                savedPaymentMethods={paymentMethods}
                workbenchMode={workbenchMode}
                onWorkbenchModeChange={setWorkbenchMode}
                onOpenAuth={handleOpenAuth}
                triggerFilePickerSignal={pickerSignal}
                minimized={workbenchMinimized}
                onMinimizeChange={handleMinimizeChange}
                onTransferToastUpdate={handleTransferToastUpdate}
                onTransferToastRemove={handleTransferToastRemove}
                onTransferRecorded={handleTransferRecorded}
                onTransferStatusSync={handleTransferStatusSync}
                onTransferDeleted={(code) => {
                  if (authUser) {
                    void deleteTransferHistoryRecord(authUser.uid, code).catch(() => {});
                  }
                }}
              />
            </div>
          </section>

          <LandingSections
            currency={currency}
            onChooseFilesClick={() => scrollToSend(true)}
            onOpenAuth={handleOpenAuth}
          />

          <PricingAndBottom
            currency={currency}
            onCurrencyChange={setCurrency}
            onSendClick={() => scrollToSend(false)}
            onOpenAuth={handleOpenAuth}
            onOpenLegal={setLegalDoc}
          />
        </main>
      )}

      <TransferToastContainer
        toasts={visibleToasts}
        onRestore={() => scrollToSend(false)}
        onDismiss={(code) =>
          setTransferToasts((prev) => dismissTransferToast(prev, code))
        }
      />

      <MobileBottomNav activeTab={mobileNavTab} onSelect={handleMobileNavSelect} />
      <OfflineIndicator />

      <AccountModal
        open={authModalOpen}
        initialTab={accountModalTab}
        user={authUser}
        authReady={authReady}
        historyEntries={historyEntries}
        historyLoading={historyLoading}
        historyError={historyError}
        paymentMethods={paymentMethods}
        paymentsLoading={paymentsLoading}
        paymentsError={paymentsError}
        onClose={() => setAuthModalOpen(false)}
        onGoogleSignIn={handleGoogleSignIn}
        onInitRecaptcha={createPhoneRecaptcha}
        onSendPhoneOtp={sendPhoneOtp}
        onFormatAuthError={formatFirebaseAuthError}
        onLogout={handleLogout}
        onDeleteHistoryEntry={handleDeleteHistoryEntry}
        onAddPaymentMethod={handleAddPaymentMethod}
        onSetDefaultPaymentMethod={handleSetDefaultPaymentMethod}
        onDeletePaymentMethod={handleDeletePaymentMethod}
      />

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}

import React from 'react';
import {
  ArrowLeftRight,
  Check,
  CreditCard,
  FileCheck2,
  Landmark,
  Lock,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { Currency, RATES } from '../utils/transferMath';

interface LandingSectionsProps {
  currency: Currency;
  onChooseFilesClick: () => void;
  onOpenAuth: (tab?: 'transfers' | 'payments') => void;
}

function SectionKicker({ label }: { label: string }) {
  return (
    <p className="font-mono-num text-[11.5px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">
      {label}
    </p>
  );
}

function CheckBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">
      <span
        aria-hidden="true"
        className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400"
      >
        <Check className="h-3 w-3 stroke-[2.5]" />
      </span>
      <span>{children}</span>
    </li>
  );
}

export function LandingSections({
  currency,
  onChooseFilesClick,
  onOpenAuth,
}: LandingSectionsProps) {
  const directRate = currency === 'INR' ? `₹${RATES.INR.p2p}` : `$${RATES.USD.p2p.toFixed(2)}`;
  const serverRate = currency === 'INR' ? `₹${RATES.INR.server}` : `$${RATES.USD.server.toFixed(2)}`;

  return (
    <>
      {/* Section: Two Delivery Lanes */}
      <section id="delivery" className="scroll-mt-20 mx-auto max-w-[1160px] px-5 sm:px-8 pt-20 pb-14">
        <div className="text-center max-w-[680px] mx-auto">
          <SectionKicker label="Two delivery lanes" />
          <h2 className="mt-3 font-display text-[34px] sm:text-[48px] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white">
            Live peer stream, or{' '}
            <span className="brand-accent-text">7-day encrypted vault.</span>
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-slate-600 dark:text-slate-300">
            Pick the delivery mode per handoff. Both modes preserve original file quality, block
            unsafe executables, and bill only per whole gigabyte.
          </p>
        </div>

        <div className="mt-11 grid gap-6 md:grid-cols-2">
          {/* Card 1: Direct (P2P) */}
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-xs flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono-num text-[11.5px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-400">
                Direct P2P Stream
              </span>
              <span className="font-mono-num text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                <strong className="text-blue-700 dark:text-blue-400">{directRate}</strong> / GB
              </span>
            </div>

            <h3 className="mt-3 font-display text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">
              Device-to-device with zero storage
            </h3>

            {/* SVG Diagram */}
            <div
              role="img"
              aria-label="Direct browser-to-browser transfer diagram"
              className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 py-6"
            >
              <div className="relative flex items-center justify-between">
                <div className="flex flex-col items-center gap-1.5 z-10">
                  <div className="h-12 w-16 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-2xs">
                    <div className="h-full w-full rounded bg-blue-100 dark:bg-blue-950" />
                  </div>
                  <div className="h-1 w-20 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                    Sender
                  </span>
                </div>

                <div className="flex-1 px-2 -mt-4">
                  <svg viewBox="0 0 180 56" className="w-full h-12 overflow-visible">
                    <defs>
                      <linearGradient id="p2pArcCobalt" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#1D4ED8" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 6 40 Q 90 -8 174 40"
                      fill="none"
                      stroke="url(#p2pArcCobalt)"
                      strokeWidth="2.5"
                      strokeDasharray="6 6"
                    />
                    <circle
                      cx="90"
                      cy="16"
                      r="5"
                      fill="#ffffff"
                      stroke="#1D4ED8"
                      strokeWidth="2.5"
                    />
                  </svg>
                  <p className="text-center font-mono-num text-[10.5px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 -mt-1">
                    DTLS encrypted · live stream
                  </p>
                </div>

                <div className="flex flex-col items-center gap-1.5 z-10">
                  <div className="h-12 w-16 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-2xs">
                    <div className="h-full w-full rounded bg-emerald-100 dark:bg-emerald-950" />
                  </div>
                  <div className="h-1 w-20 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                    Receiver
                  </span>
                </div>
              </div>
            </div>

            <ul className="mt-6 space-y-3 flex-1">
              <CheckBullet>Starts immediately when the recipient opens the link</CheckBullet>
              <CheckBullet>Zero server storage — bytes never touch cloud disks</CheckBullet>
              <CheckBullet>Up to 20 TB per transfer with folder structure intact</CheckBullet>
              <CheckBullet>Automatic ICE reconnect &amp; byte-offset resume if offline</CheckBullet>
            </ul>

            <p className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-white">Both tabs stay active</strong>{' '}
              until completion. Ideal for immediate studio or client handoffs.
            </p>
          </article>

          {/* Card 2: 7-Day Server Vault */}
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-xs flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono-num text-[11.5px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
                7-Day Vault Upload
              </span>
              <span className="font-mono-num text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                <strong className="text-emerald-700 dark:text-emerald-400">{serverRate}</strong> / GB
              </span>
            </div>

            <h3 className="mt-3 font-display text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">
              Upload once. Download asynchronously.
            </h3>

            {/* SVG Diagram */}
            <div
              role="img"
              aria-label="Upload and virus scan vault transfer diagram"
              className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 py-6"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="h-12 w-15 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-2xs">
                    <div className="h-full w-full rounded bg-blue-100 dark:bg-blue-950" />
                  </div>
                  <div className="h-1 w-18 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                    Sender
                  </span>
                </div>

                <div className="flex-1 flex flex-col items-center -mt-4">
                  <span className="font-mono-num text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    upload
                  </span>
                  <div className="relative w-full flex items-center">
                    <div className="h-[2px] w-full bg-slate-300 dark:bg-slate-700" />
                    <span className="absolute left-1/2 -translate-x-1/2 h-3 w-3 rounded-full border-2 border-blue-700 bg-white dark:bg-slate-900" />
                  </div>
                </div>

                <div className="relative flex flex-col items-center -mt-2">
                  <div className="w-16 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-1">
                      <span className="h-1.5 flex-1 rounded bg-slate-300 dark:bg-slate-700" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="h-1.5 flex-1 rounded bg-slate-300 dark:bg-slate-700" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="h-1.5 flex-1 rounded bg-slate-300 dark:bg-slate-700" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    </div>
                  </div>
                  <span className="-mt-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                </div>

                <div className="flex-1 flex flex-col items-center -mt-4">
                  <span className="font-mono-num text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    7 days
                  </span>
                  <div className="relative w-full flex items-center">
                    <div className="h-[2px] w-full border-t-2 border-dashed border-slate-300 dark:border-slate-700" />
                    <span className="absolute left-1/2 -translate-x-1/2 h-3 w-3 rounded-full border-2 border-emerald-600 bg-white dark:bg-slate-900" />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div className="h-12 w-15 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-2xs">
                    <div className="h-full w-full rounded bg-emerald-100 dark:bg-emerald-950" />
                  </div>
                  <div className="h-1 w-18 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                    Receiver
                  </span>
                </div>
              </div>
            </div>

            <ul className="mt-6 space-y-3 flex-1">
              <CheckBullet>Close your browser or phone screen as soon as upload finishes</CheckBullet>
              <CheckBullet>
                Recipient downloads anytime within 7 days, single files or bundled{' '}
                <code className="font-mono-num text-[12.5px] rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-slate-800 dark:text-slate-200">
                  .zip
                </code>
              </CheckBullet>
              <CheckBullet>Track active progress in background toast notifications</CheckBullet>
              <CheckBullet>Automated malware &amp; extension screening before release</CheckBullet>
            </ul>

            <p className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-white">Up to 50 GB per vault link.</strong>{' '}
              Built for async teams across time zones.
            </p>
          </article>
        </div>

        <div className="mt-9 text-center">
          <button
            type="button"
            onClick={onChooseFilesClick}
            className="brand-cta min-h-[46px] rounded-xl px-6 py-3 text-[15px] font-semibold text-white cursor-pointer"
          >
            Select files to transfer
          </button>
        </div>
      </section>

      {/* Section: Payment Methods & Checkout Matrix */}
      <section id="payments" className="scroll-mt-20 mx-auto max-w-[1160px] px-5 sm:px-8 pt-10 pb-14">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-10 shadow-xs">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="max-w-[640px]">
              <SectionKicker label="Checkout & saved methods" />
              <h2 className="mt-2.5 font-display text-[30px] sm:text-[40px] font-extrabold leading-[1.1] tracking-[-0.025em] text-slate-900 dark:text-white">
                Pay by UPI, Card, NetBanking, or Wallet.{' '}
                <span className="brand-accent-text">Or let the receiver pay.</span>
              </h2>
              <p className="mt-3 text-[15px] text-slate-600 dark:text-slate-300">
                Save your preferred payment handles in your account wallet once — synced across
                desktop and the phone app via your Google ID or Phone OTP login.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth('payments')}
              className="brand-cta min-h-[44px] inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white cursor-pointer shrink-0"
            >
              <CreditCard className="h-4 w-4" />
              Manage payment methods
            </button>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {/* India · Razorpay */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono-num text-[11.5px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  India · INR (₹)
                </span>
                <span className="font-mono-num text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                  Razorpay
                </span>
              </div>
              <h3 className="font-display text-[18px] font-bold text-slate-900 dark:text-white">
                Instant UPI, Cards &amp; NetBanking
              </h3>
              <ul className="space-y-2 text-[13.5px] text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>UPI ID &amp; QR (GPay, PhonePe, Paytm, BHIM)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>RuPay, Visa &amp; Mastercard Debit / Credit</span>
                </li>
                <li className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>All major Indian NetBanking portals</span>
                </li>
              </ul>
            </div>

            {/* Global · Stripe */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono-num text-[11.5px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Global · USD ($)
                </span>
                <span className="font-mono-num text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                  Stripe
                </span>
              </div>
              <h3 className="font-display text-[18px] font-bold text-slate-900 dark:text-white">
                International Cards &amp; Digital Wallets
              </h3>
              <ul className="space-y-2 text-[13.5px] text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Visa, Mastercard, Amex &amp; corporate cards</span>
                </li>
                <li className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Apple Pay, Google Pay &amp; Stripe Link</span>
                </li>
                <li className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Instant itemized entry in Transfer History</span>
                </li>
              </ul>
            </div>

            {/* Receiver Pays */}
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono-num text-[11.5px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  Collect-on-Delivery
                </span>
                <ArrowLeftRight className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              </div>
              <h3 className="font-display text-[18px] font-bold text-slate-900 dark:text-white">
                Ask the receiver to pay
              </h3>
              <p className="text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                Toggle receiver-pays on any transfer. The client previews the exact quote on the
                download screen and unlocks via Razorpay or Stripe before bytes stream.
              </p>
              <button
                type="button"
                onClick={onChooseFilesClick}
                className="text-[13px] font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Try receiver-pays in workbench →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section: How It Works */}
      <section id="how" className="scroll-mt-20 mx-auto max-w-[1160px] px-5 sm:px-8 pt-12 pb-14">
        <div className="text-center max-w-[700px] mx-auto">
          <SectionKicker label="How the bytes move" />
          <h2 className="mt-3 font-display text-[34px] sm:text-[46px] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white">
            One direct tunnel.{' '}
            <span className="brand-accent-text">No cloud bottleneck.</span>
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-slate-600 dark:text-slate-300">
            In Direct mode, our signaling service introduces both devices and steps out. Payloads
            stream over DTLS-encrypted WebRTC channels straight to the recipient&apos;s storage.
          </p>
        </div>

        {/* Architecture Flow Diagram */}
        <div className="mt-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-9 shadow-xs">
          <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] items-center">
            {/* Your Device */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
              <div className="flex items-center justify-between text-[13px] font-semibold text-slate-900 dark:text-white">
                <span>Your device / phone</span>
                <span className="font-mono-num text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  Sending
                </span>
              </div>
              <ul className="mt-3.5 divide-y divide-slate-200 dark:divide-slate-800 text-[12.5px] font-mono-num">
                <li className="flex items-center justify-between py-2">
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    Product-Launch/4K-Master.mov
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 ml-2">4.2 GB</span>
                </li>
                <li className="flex items-center justify-between py-2">
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    Design-System/Brand-Assets.zip
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 ml-2">1.8 GB</span>
                </li>
                <li className="flex items-center justify-between py-2">
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    RAW-Stills/Set-01.dng
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 ml-2">940 MB</span>
                </li>
              </ul>
            </div>

            {/* Center Handshake + Direct Pipe */}
            <div className="flex flex-col items-center gap-4 px-2">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-center">
                <p className="font-mono-num text-[12px] font-semibold text-slate-900 dark:text-white">
                  Signaling Relay
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Introduces peers · never stores files
                </p>
              </div>
              <div className="w-full min-w-[180px] space-y-1.5">
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="brand-primary-bg animate-pulse-flow h-full w-1/3 rounded-full" />
                </div>
                <p className="text-center font-mono-num text-[10.5px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                  DTLS encrypted · P2P
                </p>
              </div>
            </div>

            {/* Their Device */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
              <div className="flex items-center justify-between text-[13px] font-semibold text-slate-900 dark:text-white">
                <span>Recipient browser</span>
                <span className="font-mono-num text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Receiving
                </span>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
                <div className="flex items-center justify-between text-[12.5px] font-mono-num">
                  <span className="text-slate-700 dark:text-slate-300">Writing to disk</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Direct stream
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="h-full w-3/4 rounded-full bg-emerald-600" />
                </div>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                  Bit-exact directory structure preserved.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Numbered Step Cards */}
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {
              num: '01',
              title: 'Drop studio files or folders',
              desc: 'We read only byte sizes locally, run extension screening, and lock in an exact per-GB quote.',
            },
            {
              num: '02',
              title: 'Select payment or receiver-pays',
              desc: 'Use a saved card/UPI handle, pay via Razorpay (UPI, Card, NetBanking) or Stripe (Card, Wallet), or collect from the receiver.',
            },
            {
              num: '03',
              title: 'Share link & track progress',
              desc: 'Minimize the workbench anytime — live progress stays visible in background toast notifications across desktop and mobile.',
            },
          ].map((step) => (
            <li
              key={step.num}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xs"
            >
              <span className="inline-flex h-8 px-2.5 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/70 font-mono-num text-[13px] font-bold text-blue-700 dark:text-blue-400">
                {step.num}
              </span>
              <h3 className="mt-4 font-display text-[18.5px] font-bold text-slate-900 dark:text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                {step.desc}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Stats Strip */}
      <section
        aria-label="Platform limits and guarantees"
        className="mx-auto max-w-[1160px] px-5 sm:px-8 py-6"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          {[
            { val: '20 TB', label: 'max per Direct transfer' },
            { val: '0 bytes', label: 'stored on server in Direct mode' },
            { val: '100%', label: 'lossless original files' },
            { val: '7 days', label: 'async Vault retention' },
          ].map((stat) => (
            <div key={stat.label} className="px-6 py-6 sm:px-7 sm:py-7">
              <div className="font-display text-[32px] sm:text-[40px] font-extrabold tracking-tight brand-accent-text font-mono-num">
                {stat.val}
              </div>
              <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section: Built for Studio Delivery (Bento Grid) */}
      <section id="features" className="scroll-mt-20 mx-auto max-w-[1160px] px-5 sm:px-8 pt-16 pb-14">
        <div className="max-w-[660px]">
          <SectionKicker label="Built for studio delivery" />
          <h2 className="mt-3 font-display text-[34px] sm:text-[46px] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white">
            Fast transfer engine.{' '}
            <span className="brand-accent-text">Mobile-ready shell.</span>
          </h2>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {/* Wide Card 1 */}
          <article className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xs grid gap-6 sm:grid-cols-[1fr_1.1fr] items-center">
            <div>
              <h3 className="font-display text-[20px] font-bold text-slate-900 dark:text-white">
                Directory trees stay intact
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                Drop complex engineering builds, Figma exports, or 4K camera reels. Folder paths
                and nested sub-directories arrive identical.
              </p>
            </div>
            <div
              aria-hidden="true"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 font-mono-num text-[12px] leading-7 text-slate-700 dark:text-slate-300"
            >
              <div className="font-semibold text-slate-900 dark:text-white">Product-Launch/</div>
              <div className="text-slate-500 dark:text-slate-400">├─ exports/</div>
              <div className="flex justify-between">
                <span>│ ├─ 4K-Master.mov</span>
                <span className="text-slate-500 dark:text-slate-400">4.2 GB</span>
              </div>
              <div className="flex justify-between">
                <span>│ └─ Brand-Assets.zip</span>
                <span className="text-slate-500 dark:text-slate-400">1.8 GB</span>
              </div>
              <div className="flex justify-between">
                <span>├─ RAW-Stills/</span>
                <span className="text-slate-500 dark:text-slate-400">860 files</span>
              </div>
              <div className="flex justify-between">
                <span>└─ Release-Notes.pdf</span>
                <span className="text-slate-500 dark:text-slate-400">42 MB</span>
              </div>
            </div>
          </article>

          {/* Card 2 */}
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xs flex flex-col justify-between">
            <div>
              <span className="brand-primary-bg inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm">
                <Smartphone className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-[19px] font-bold text-slate-900 dark:text-white">
                Installable phone app
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                Add Share by Jalpi to your Android or iPhone home screen for thumb navigation,
                offline shell caching, and Google Phone OTP access.
              </p>
            </div>
            <p className="mt-5 font-mono-num text-[12px] font-semibold text-blue-700 dark:text-blue-400">
              Standalone PWA · iOS &amp; Android
            </p>
          </article>

          {/* Card 3 */}
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xs">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400">
              <Lock className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-display text-[19px] font-bold text-slate-900 dark:text-white">
              End-to-end transport encryption
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
              WebRTC DTLS secures peer-to-peer streams directly between browsers; vault uploads
              transfer strictly over HTTPS.
            </p>
          </article>

          {/* Card 4 */}
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xs">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400">
              <Sparkles className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-display text-[19px] font-bold text-slate-900 dark:text-white">
              Zero media compression
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
              RAW stills, ProRes edits, and archive bundles land byte-for-byte intact without
              transcoding or quality loss.
            </p>
          </article>

          {/* Card 5 */}
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xs flex flex-col justify-between">
            <div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400">
                <FileCheck2 className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-[19px] font-bold text-slate-900 dark:text-white">
                Pre-flight malware gate
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                Scripts, executables, and risky binaries are filtered before transmission; vault
                uploads are scanned automatically.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-950 px-3.5 py-2 font-mono-num text-[12px]">
              <span className="text-slate-600 dark:text-slate-300">6.9 GB selected</span>
              <span className="text-slate-400">→</span>
              <span className="font-bold text-blue-700 dark:text-blue-400">7 GB billed</span>
            </div>
          </article>
        </div>
      </section>

      {/* Section: The Difference */}
      <section className="mx-auto max-w-[1160px] px-5 sm:px-8 pt-10 pb-16">
        <div className="text-center max-w-[660px] mx-auto">
          <SectionKicker label="Why direct" />
          <h2 className="mt-3 font-display text-[32px] sm:text-[44px] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white">
            Stop uploading twice for{' '}
            <span className="brand-accent-text">every handoff.</span>
          </h2>
        </div>

        <div className="mt-9 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60 p-7 sm:p-8">
            <p className="font-mono-num text-[11.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Traditional cloud storage
            </p>
            <div className="mt-5 space-y-2.5 text-[11.5px] font-mono-num uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-3">
                <span className="w-20">Upload</span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full w-1/2 rounded-full bg-slate-400 dark:bg-slate-600" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-20">Download</span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="ml-auto h-full w-1/2 rounded-full bg-slate-500 dark:bg-slate-500" />
                </div>
              </div>
            </div>
            <ul className="mt-6 space-y-3 text-[14.5px] text-slate-600 dark:text-slate-300">
              {[
                'Wait for full cloud upload before your client can even start downloading.',
                'Duplicate copies linger across third-party storage buckets.',
                'Mandatory monthly storage tiers even when you only ship occasionally.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <X className="h-4 w-4 shrink-0 mt-1 text-slate-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-xs">
            <p className="font-mono-num text-[11.5px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-400">
              Share by Jalpi · Direct P2P
            </p>
            <div className="mt-5 space-y-2 text-[11.5px] font-mono-num">
              <div className="flex items-center gap-3">
                <span className="w-24 uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Live pipe
                </span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="brand-primary-bg h-full w-1/2 rounded-full" />
                </div>
              </div>
              <p className="pl-27 text-[12px] font-sans font-medium text-blue-700 dark:text-blue-400">
                Delivered while legacy drives are still uploading
              </p>
            </div>
            <ul className="mt-6 space-y-3">
              <CheckBullet>Bytes begin streaming on link open with zero upload queue.</CheckBullet>
              <CheckBullet>Zero storage footprint once both devices disconnect.</CheckBullet>
              <CheckBullet>Pay per whole GB via UPI, Card, NetBanking, or Wallet.</CheckBullet>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

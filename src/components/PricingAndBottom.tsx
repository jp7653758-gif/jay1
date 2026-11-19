import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import {
  calculatePrice,
  Currency,
  formatCompactPrice,
  formatGbDisplay,
  SLIDER_GB_STOPS,
  sliderIndexToGb,
} from '../utils/transferMath';
import { BrandMark } from './BrandMark';
import { PWAInstallButton } from './PWAInstallButton';
import { SearchGroundingPanel } from './SearchGroundingPanel';

interface PricingAndBottomProps {
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  onSendClick: () => void;
  onOpenAuth: (tab?: 'transfers' | 'payments') => void;
  onOpenLegal: (doc: 'privacy' | 'terms' | 'refunds') => void;
}

const FAQS = [
  {
    q: 'How do Google ID and Google Phone OTP logins work?',
    a: 'Sign in with a single tap via Google Sign-In or verify your mobile number using a Google Firebase 6-digit SMS OTP. Signing in syncs your Transfer History and saved Payment Methods across web and the installed phone app.',
  },
  {
    q: 'Which payment methods are supported?',
    a: 'In India (INR), pay through Razorpay using UPI (ID/QR), Debit/Credit Cards, or NetBanking. Everywhere else (USD), pay through Stripe using international cards or digital wallets. You can also save default payment handles inside Account -> Payment Methods.',
  },
  {
    q: 'Can I install Share by Jalpi as a phone app?',
    a: 'Yes. Share by Jalpi is an installable Progressive Web App (PWA) for Android and iPhone with standalone launch mode, offline shell caching, and fixed thumb-reach mobile navigation.',
  },
  {
    q: 'Can the receiver pay instead of the sender?',
    a: 'Yes. Enable "Ask the receiver to pay" when preparing your transfer. The recipient views the locked file manifest and exact fee first, then pays via Razorpay or Stripe to unlock download.',
  },
  {
    q: 'Do both people need to stay online?',
    a: 'For Direct P2P (up to 20 TB), yes — bytes stream directly over DTLS WebRTC while both tabs are active, leaving zero stored copy. For 7-day Vault (up to 50 GB), no — you can close the tab right after uploading.',
  },
  {
    q: 'What if the network drops midway?',
    a: 'Direct transfers auto-reconnect and resume cleanly without double-charging. If you minimize the workbench during any upload or P2P stream, live progress remains visible in global background toasts.',
  },
] as const;

export function PricingAndBottom({
  currency,
  onCurrencyChange,
  onSendClick,
  onOpenAuth,
  onOpenLegal,
}: PricingAndBottomProps) {
  const [sliderIdx, setSliderIdx] = useState(5); // 10 GB

  const gb = sliderIndexToGb(sliderIdx);
  const display = formatGbDisplay(gb);
  const directQuote = calculatePrice(gb, 'p2p', currency);
  const uploadQuote = calculatePrice(gb, 'server', currency);
  const pct = (sliderIdx / (SLIDER_GB_STOPS.length - 1)) * 100;

  return (
    <>
      {/* Pricing Calculator Section */}
      <section id="pricing" className="scroll-mt-20 mx-auto max-w-[1160px] px-5 sm:px-8 py-12">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-12 lg:p-14 grid gap-10 lg:grid-cols-[1fr_1.05fr] items-center shadow-xs">
          <div>
            <p className="font-mono-num text-[11.5px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">
              Metered pricing
            </p>
            <h2 className="mt-3 font-display text-[34px] sm:text-[46px] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white">
              Pay only for the gigabytes.{' '}
              <span className="brand-accent-text">No monthly lock-in.</span>
            </h2>

            <ul className="mt-7 space-y-3.5 text-[15px] text-slate-600 dark:text-slate-300">
              {[
                'No subscription fees — pay per transfer or let the receiver pay',
                'Whole-GB rounding upfront, minimum 1 GB per transfer',
                'India (INR): Razorpay UPI, Cards & NetBanking',
                'Worldwide (USD): Stripe Cards & Digital Wallets',
                'Save default payment handles in your synced account wallet',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400"
                  >
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Calculator Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                Estimated size
              </span>
              <div
                role="group"
                aria-label="Currency"
                className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-[12.5px] font-semibold"
              >
                <button
                  type="button"
                  aria-pressed={currency === 'INR'}
                  onClick={() => onCurrencyChange('INR')}
                  className={`rounded-[9px] px-3 py-1 transition-colors cursor-pointer ${
                    currency === 'INR'
                      ? 'bg-blue-700 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  ₹ INR
                </button>
                <button
                  type="button"
                  aria-pressed={currency === 'USD'}
                  onClick={() => onCurrencyChange('USD')}
                  className={`rounded-[9px] px-3 py-1 transition-colors cursor-pointer ${
                    currency === 'USD'
                      ? 'bg-blue-700 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  $ USD
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <output className="font-display text-[50px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-white font-mono-num">
                {display.value}
              </output>
              <span className="font-display text-[20px] font-bold text-slate-500 dark:text-slate-400">
                {display.unit}
              </span>
            </div>

            <div className="mt-5">
              <label htmlFor="pricing-slider" className="sr-only">
                Transfer size
              </label>
              <input
                id="pricing-slider"
                type="range"
                min={0}
                max={SLIDER_GB_STOPS.length - 1}
                step={1}
                value={sliderIdx}
                onChange={(e) => setSliderIdx(Number(e.target.value))}
                style={{
                  background: `linear-gradient(90deg, #1d4ed8 0%, #0284c7 ${pct}%, #cbd5e1 ${pct}%, #cbd5e1 100%)`,
                }}
                className="cobalt-range w-full cursor-pointer"
              />
              <div
                aria-hidden="true"
                className="mt-2.5 flex justify-between font-mono-num text-[11px] text-slate-500 dark:text-slate-400"
              >
                <span>1 GB</span>
                <span>100 GB</span>
                <span>20 TB</span>
              </div>
            </div>

            <div className="mt-6 border-t border-dashed border-slate-300 dark:border-slate-700 pt-5 space-y-2">
              <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                Direct P2P Rate
              </p>
              <output className="block font-display text-[42px] font-extrabold leading-none tracking-tight brand-accent-text font-mono-num">
                {directQuote.formatted}
              </output>
              <p className="font-mono-num text-[12.5px] text-slate-600 dark:text-slate-300">
                {gb} GB × {directQuote.perGbFormatted} · {directQuote.gatewayLabel}
              </p>

              <div className="mt-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 px-3.5 py-2.5 text-[12.5px] text-slate-700 dark:text-slate-300">
                {gb <= 50 ? (
                  <>
                    7-Day Vault option:{' '}
                    <strong className="text-blue-700 dark:text-blue-400 font-mono-num">
                      {formatCompactPrice(uploadQuote.amount, currency)}
                    </strong>{' '}
                    · available anytime for 7 days
                  </>
                ) : (
                  <>Vault supports up to 50 GB; use Direct P2P seamlessly up to 20 TB.</>
                )}
              </div>
            </div>

            <a
              href="#send"
              onClick={(e) => {
                e.preventDefault();
                onSendClick();
              }}
              className="brand-cta mt-6 block w-full min-h-[46px] rounded-xl py-3 text-center text-[15px] font-semibold text-white cursor-pointer"
            >
              Start a transfer
            </a>
          </div>
        </div>

        <SearchGroundingPanel />
      </section>

      {/* Privacy Section */}
      <section id="privacy" className="scroll-mt-20 mx-auto max-w-[1160px] px-5 sm:px-8 pt-16 pb-14">
        <div className="text-center max-w-[680px] mx-auto">
          <p className="font-mono-num text-[11.5px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">
            Zero-knowledge transparency
          </p>
          <h2 className="mt-3 font-display text-[34px] sm:text-[46px] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white">
            What our servers handle,{' '}
            <span className="brand-accent-text">and what stays private.</span>
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-xs">
            <p className="font-mono-num text-[11.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Processed on server
            </p>
            <ul className="mt-5 space-y-3.5 text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">
              {[
                'File names and total byte sizes to compute accurate quotes and block unsafe binaries',
                'Your verified Google ID or Phone OTP number to sync Transfer History and saved payment methods',
                'Payment completion webhooks from Razorpay or Stripe',
                'Transient WebRTC signaling metadata to pair two browsers',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600"
                  />
                  <span>{item}</span>
                </li>
              ))}
              <li className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600"
                />
                <span>
                  <strong className="text-slate-900 dark:text-white">Vault uploads only:</strong>{' '}
                  scanned files retained for up to 7 days until downloaded or deleted early.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60 p-7 sm:p-8">
            <p className="font-mono-num text-[11.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Never seen or stored
            </p>
            <ul className="mt-5 space-y-4 text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <X className="h-4 w-4 shrink-0 mt-1 text-blue-700 dark:text-blue-400" />
                <span>
                  Contents of any <strong className="text-slate-900 dark:text-white">Direct P2P</strong>{' '}
                  transfer
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="h-4 w-4 shrink-0 mt-1 text-blue-700 dark:text-blue-400" />
                <span>Full card numbers, CVV codes, or UPI PIN credentials</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="h-4 w-4 shrink-0 mt-1 text-blue-700 dark:text-blue-400" />
                <span>Unencrypted cloud copies when streaming device-to-device</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="scroll-mt-20 mx-auto max-w-[1160px] px-5 sm:px-8 pt-10 pb-16">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] items-start">
          <div>
            <p className="font-mono-num text-[11.5px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">
              Questions &amp; answers
            </p>
            <h2 className="mt-3 font-display text-[34px] sm:text-[44px] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white">
              Clear answers before{' '}
              <span className="brand-accent-text">you send.</span>
            </h2>
            <p className="mt-3 text-[15.5px] text-slate-600 dark:text-slate-300">
              Everything about authentication, payments, mobile installation, and P2P delivery.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 shadow-2xs transition-colors"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-[16px] font-bold text-slate-900 dark:text-white select-none">
                  <span>{faq.q}</span>
                  <span
                    aria-hidden="true"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white transition-transform group-open:rotate-45"
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                </summary>
                <p className="mt-3 border-t border-slate-200 dark:border-slate-800 pt-3 text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Card */}
      <section className="mx-auto max-w-[1160px] px-5 sm:px-8 pb-16">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-12 sm:py-14 text-center shadow-xs">
          <h2 className="font-display text-[32px] sm:text-[48px] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white">
            Your assets. Their screen.{' '}
            <span className="brand-accent-text">Ready on web and phone.</span>
          </h2>
          <p className="mt-4 text-[16px] text-slate-600 dark:text-slate-300">
            Send now with Google ID or Phone OTP, or install the standalone mobile app.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#send"
              onClick={(e) => {
                e.preventDefault();
                onSendClick();
              }}
              className="brand-cta min-h-[46px] inline-flex items-center rounded-xl px-6 py-3 text-[15px] font-semibold text-white cursor-pointer"
            >
              Send files now
            </a>
            <PWAInstallButton />
            <a
              href="#pricing"
              className="min-h-[46px] inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-[15px] font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Pricing calculator
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pb-24 md:pb-10">
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8 py-12">
          <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <a href="/" aria-label="Share by Jalpi, home">
                <BrandMark />
              </a>
              <p className="mt-4 max-w-[300px] text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
                Direct P2P streaming &amp; 7-day encrypted vaults on desktop and phone. Pay per GB
                with UPI, cards, NetBanking, or digital wallets.
              </p>
            </div>

            <div>
              <h6 className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-900 dark:text-white">
                Platform
              </h6>
              <ul className="mt-4 space-y-2.5 text-[14px] text-slate-600 dark:text-slate-300">
                <li>
                  <a
                    href="#send"
                    onClick={(e) => {
                      e.preventDefault();
                      onSendClick();
                    }}
                    className="hover:text-slate-950 dark:hover:text-white"
                  >
                    Send files
                  </a>
                </li>
                <li>
                  <a href="#delivery" className="hover:text-slate-950 dark:hover:text-white">
                    Delivery modes
                  </a>
                </li>
                <li>
                  <a href="#payments" className="hover:text-slate-950 dark:hover:text-white">
                    Payment methods
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-slate-950 dark:hover:text-white">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-slate-950 dark:hover:text-white">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h6 className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-900 dark:text-white">
                Account &amp; Wallet
              </h6>
              <ul className="mt-4 space-y-2.5 text-[14px] text-slate-600 dark:text-slate-300">
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('transfers')}
                    className="hover:text-slate-950 dark:hover:text-white cursor-pointer"
                  >
                    Google ID / Phone OTP
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('transfers')}
                    className="hover:text-slate-950 dark:hover:text-white cursor-pointer"
                  >
                    Transfer History
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('payments')}
                    className="hover:text-slate-950 dark:hover:text-white cursor-pointer"
                  >
                    Payment Methods
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h6 className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-900 dark:text-white">
                Legal
              </h6>
              <ul className="mt-4 space-y-2.5 text-[14px] text-slate-600 dark:text-slate-300">
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenLegal('privacy')}
                    className="hover:text-slate-950 dark:hover:text-white cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenLegal('terms')}
                    className="hover:text-slate-950 dark:hover:text-white cursor-pointer"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenLegal('refunds')}
                    className="hover:text-slate-950 dark:hover:text-white cursor-pointer"
                  >
                    Refunds &amp; Cancellations
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-200 dark:border-slate-800 pt-6 text-[13px] text-slate-500 dark:text-slate-400">
            © 2026 Share by Jalpi · Studio File Delivery &amp; Installable Phone App.
          </div>
        </div>
      </footer>
    </>
  );
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveDestination,
  filterTransferHistory,
  formatPaymentSummary,
  resolvePaymentSelection,
  summarizeTransferHistory,
  TransferHistoryEntry,
  validatePaymentMethodInput,
} from './transferHistory';

test('resolvePaymentSelection maps India to Razorpay INR (UPI, Card, NetBanking) and Global to Stripe USD (Card, Wallet)', () => {
  assert.deepEqual(resolvePaymentSelection('IN', 'upi'), {
    region: 'IN',
    gateway: 'razorpay',
    method: 'upi',
    currency: 'INR',
  });
  assert.deepEqual(resolvePaymentSelection('IN', 'netbanking'), {
    region: 'IN',
    gateway: 'razorpay',
    method: 'netbanking',
    currency: 'INR',
  });
  assert.deepEqual(resolvePaymentSelection('GLOBAL', 'wallet'), {
    region: 'GLOBAL',
    gateway: 'stripe',
    method: 'wallet',
    currency: 'USD',
  });
  // Global rejects India-only UPI and falls back to Stripe Card
  assert.deepEqual(resolvePaymentSelection('GLOBAL', 'upi'), {
    region: 'GLOBAL',
    gateway: 'stripe',
    method: 'card',
    currency: 'USD',
  });
});

test('validatePaymentMethodInput validates UPI handles and saved payment labels cleanly', () => {
  const badUpi = validatePaymentMethodInput({
    label: 'Primary UPI',
    region: 'IN',
    method: 'upi',
    detail: 'not-a-upi-id',
  });
  assert.equal(badUpi.ok, false);

  const validUpi = validatePaymentMethodInput({
    label: 'Studio GPay',
    region: 'IN',
    method: 'upi',
    detail: 'studio@okaxis',
  });
  assert.equal(validUpi.ok, true);
  if (validUpi.ok) {
    assert.equal(validUpi.selection.gateway, 'razorpay');
    assert.equal(validUpi.detail, 'studio@okaxis');
  }
});

test('deriveDestination trims and falls back cleanly by mode and payerRole', () => {
  assert.equal(deriveDestination('  client@acme.in  ', 'p2p', 'sender'), 'client@acme.in');
  assert.equal(deriveDestination('', 'p2p', 'sender'), 'Direct P2P · Device-to-device');
  assert.equal(deriveDestination('', 'server', 'receiver'), '7-day vault · Receiver pays');
});

test('formatPaymentSummary formats Razorpay, Stripe, NetBanking, Wallet, and receiver-pays states clearly', () => {
  assert.equal(
    formatPaymentSummary('razorpay', 'upi', 'sender', 'paid'),
    'Paid · Razorpay · UPI'
  );
  assert.equal(
    formatPaymentSummary('razorpay', 'netbanking', 'sender', 'paid'),
    'Paid · Razorpay · NetBanking'
  );
  assert.equal(
    formatPaymentSummary('stripe', 'wallet', 'receiver', 'pending_receiver'),
    'Receiver pays · Stripe · Wallet'
  );
  assert.equal(
    formatPaymentSummary('razorpay', 'card', 'receiver', 'paid'),
    'Receiver paid · Razorpay · Card'
  );
});

test('summarizeTransferHistory and filterTransferHistory compute totals and filters accurately', () => {
  const sample: TransferHistoryEntry[] = [
    {
      code: 'A1B2C3D4',
      ownerUid: 'u1',
      headline: 'Launch-Master.mov',
      fileCount: 1,
      totalBytes: 2 * 1024 * 1024 * 1024,
      billedGb: 2,
      mode: 'p2p',
      destination: 'Mumbai Studio',
      currency: 'INR',
      priceAmount: 2,
      priceFormatted: '₹2',
      paymentGateway: 'razorpay',
      paymentMethod: 'upi',
      payerRole: 'sender',
      paymentStatus: 'paid',
      status: 'delivered',
      shareUrl: 'https://share.jalpi.com/?t=A1B2C3D4',
      createdAtMs: 1000,
    },
    {
      code: 'E5F6G7H8',
      ownerUid: 'u1',
      headline: 'Archive.zip',
      fileCount: 1,
      totalBytes: 5 * 1024 * 1024 * 1024,
      billedGb: 5,
      mode: 'server',
      destination: 'London Agency',
      currency: 'USD',
      priceAmount: 0.5,
      priceFormatted: '$0.50',
      paymentGateway: 'stripe',
      paymentMethod: 'wallet',
      payerRole: 'receiver',
      paymentStatus: 'pending_receiver',
      status: 'ready',
      shareUrl: 'https://share.jalpi.com/?t=E5F6G7H8',
      createdAtMs: 2000,
    },
    {
      code: 'DEL12345',
      ownerUid: 'u1',
      headline: 'Deleted.mov',
      fileCount: 1,
      totalBytes: 1024,
      billedGb: 1,
      mode: 'server',
      destination: 'Removed',
      currency: 'USD',
      priceAmount: 0.5,
      priceFormatted: '$0.50',
      paymentGateway: 'stripe',
      paymentMethod: 'card',
      payerRole: 'sender',
      paymentStatus: 'paid',
      status: 'deleted',
      shareUrl: 'https://share.jalpi.com/?t=DEL12345',
      createdAtMs: 3000,
    },
  ];

  const summary = summarizeTransferHistory(sample);
  assert.equal(summary.totalTransfers, 2);
  assert.equal(summary.totalBilledGb, 7);
  assert.equal(summary.costSummaryLabel, '$0.50 + ₹2');

  assert.equal(filterTransferHistory(sample, 'all', '').length, 2);
  assert.equal(filterTransferHistory(sample, 'receiver_pays', '').length, 1);
  assert.equal(filterTransferHistory(sample, 'all', 'mumbai')[0].code, 'A1B2C3D4');
});

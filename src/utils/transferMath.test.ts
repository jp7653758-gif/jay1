import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePrice,
  computeBilledGb,
  formatBytes,
  formatCompactPrice,
  formatGbDisplay,
  screenFileNames,
  sliderIndexToGb,
} from './transferMath';

test('formatBytes formats bytes cleanly across B, KB, MB, GB, TB', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(819 * 1024 * 1024), '819 MB');
  assert.equal(formatBytes(3.4 * 1024 * 1024 * 1024), '3.4 GB');
});

test('computeBilledGb rounds up to whole GB with 1 GB minimum', () => {
  assert.equal(computeBilledGb(0), 1);
  assert.equal(computeBilledGb(500 * 1024 * 1024), 1);
  assert.equal(computeBilledGb(6.3 * 1024 * 1024 * 1024), 7);
});

test('calculatePrice applies per-GB rate and minimum card charge in USD and INR', () => {
  const usdMin = calculatePrice(1, 'p2p', 'USD');
  assert.equal(usdMin.formatted, '$0.50');
  assert.equal(usdMin.isMinimumApplied, true);

  const usdTen = calculatePrice(10, 'p2p', 'USD');
  assert.equal(usdTen.formatted, '$0.50');
  assert.equal(usdTen.isMinimumApplied, false);

  const usdUploadTen = calculatePrice(10, 'server', 'USD');
  assert.equal(usdUploadTen.formatted, '$1.00');
  assert.equal(formatCompactPrice(usdUploadTen.amount, 'USD'), '$1');

  const inrTen = calculatePrice(10, 'p2p', 'INR');
  assert.equal(inrTen.formatted, '₹10');
  assert.equal(inrTen.gatewayLabel, 'Razorpay · UPI or card');
});

test('sliderIndexToGb maps index 5 to 10 GB and clamps bounds', () => {
  assert.equal(sliderIndexToGb(0), 1);
  assert.equal(sliderIndexToGb(5), 10);
  assert.equal(sliderIndexToGb(10), 100);
  assert.equal(sliderIndexToGb(99), 20480);
  assert.equal(formatGbDisplay(1024).unit, 'TB');
});

test('screenFileNames rejects dangerous scripts/executables and allows media/docs', () => {
  const safe = screenFileNames(['A001.mov', 'Wedding-Shoot/edit.mp4', 'archive.zip']);
  assert.equal(safe.allowed, true);
  assert.equal(safe.blockedFiles.length, 0);

  const unsafe = screenFileNames(['invoice.pdf', 'payload.exe', 'macro.docm']);
  assert.equal(unsafe.allowed, false);
  assert.deepEqual(unsafe.blockedFiles, ['payload.exe', 'macro.docm']);
});

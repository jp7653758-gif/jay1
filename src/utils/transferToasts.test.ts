import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActiveTransferToast,
  dismissTransferToast,
  formatToastHeadline,
  formatToastMeta,
  getVisibleTransferToasts,
  isTransferActive,
  reopenAllTransferToasts,
  upsertTransferToast,
} from './transferToasts';

const sampleToast: ActiveTransferToast = {
  code: 'AbCd1234',
  mode: 'p2p',
  fileCount: 2,
  firstFileName: 'Wedding-Shoot-Clip.mov',
  totalBytes: 120,
  progress: 45,
  phase: 'streaming',
  statusText: 'Streaming directly… 45%',
  shareUrl: 'http://localhost:3000/?t=AbCd1234',
};

test('getVisibleTransferToasts shows non-dismissed transfers only when minimized', () => {
  const list = upsertTransferToast([], sampleToast);
  assert.equal(getVisibleTransferToasts(list, false).length, 0);
  assert.equal(getVisibleTransferToasts(list, true).length, 1);

  const dismissed = dismissTransferToast(list, 'AbCd1234');
  assert.equal(getVisibleTransferToasts(dismissed, true).length, 0);

  const reopened = reopenAllTransferToasts(dismissed);
  assert.equal(getVisibleTransferToasts(reopened, true).length, 1);
});

test('upsertTransferToast clamps progress and reopens dismissed toast on delivery', () => {
  const initial = dismissTransferToast(
    upsertTransferToast([], { ...sampleToast, progress: 120 }),
    'AbCd1234'
  );
  assert.equal(initial[0].progress, 100);
  assert.equal(initial[0].dismissed, true);

  const finished = upsertTransferToast(initial, {
    ...sampleToast,
    progress: 100,
    phase: 'delivered',
    statusText: 'Delivered directly',
  });
  assert.equal(finished[0].dismissed, false);
  assert.equal(isTransferActive(finished[0].phase), false);
});

test('formatToastHeadline and formatToastMeta format file count and mode', () => {
  assert.equal(formatToastHeadline(sampleToast), 'Wedding-Shoot-Clip.mov + 1 more');
  assert.equal(formatToastMeta(sampleToast), 'Direct (P2P) · 120 B');
  assert.equal(
    formatToastHeadline({ ...sampleToast, fileCount: 1 }),
    'Wedding-Shoot-Clip.mov'
  );
});

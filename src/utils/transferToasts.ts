import { formatBytes, TransferMode } from './transferMath';

export type TransferPhase =
  | 'waiting'
  | 'connected'
  | 'uploading'
  | 'streaming'
  | 'ready'
  | 'delivered'
  | 'error';

export interface ActiveTransferToast {
  code: string;
  mode: TransferMode;
  fileCount: number;
  firstFileName: string;
  totalBytes: number;
  progress: number;
  phase: TransferPhase;
  statusText: string;
  shareUrl: string;
  dismissed?: boolean;
}

export function isTransferActive(phase: TransferPhase): boolean {
  return (
    phase === 'waiting' ||
    phase === 'connected' ||
    phase === 'uploading' ||
    phase === 'streaming'
  );
}

export function upsertTransferToast(
  list: ActiveTransferToast[],
  incoming: ActiveTransferToast
): ActiveTransferToast[] {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(incoming.progress)));
  const normalized: ActiveTransferToast = {
    ...incoming,
    progress: clampedProgress,
  };

  const existingIdx = list.findIndex((t) => t.code === incoming.code);
  if (existingIdx === -1) {
    return [normalized, ...list];
  }

  const prev = list[existingIdx];
  const reopenOnFinish =
    (incoming.phase === 'delivered' || incoming.phase === 'ready') &&
    prev.phase !== incoming.phase;

  const updated: ActiveTransferToast = {
    ...normalized,
    dismissed: reopenOnFinish ? false : prev.dismissed ?? false,
  };

  return list.map((item, idx) => (idx === existingIdx ? updated : item));
}

export function dismissTransferToast(
  list: ActiveTransferToast[],
  code: string
): ActiveTransferToast[] {
  return list.map((item) => (item.code === code ? { ...item, dismissed: true } : item));
}

export function reopenAllTransferToasts(list: ActiveTransferToast[]): ActiveTransferToast[] {
  return list.map((item) => ({ ...item, dismissed: false }));
}

export function removeTransferToast(
  list: ActiveTransferToast[],
  code: string
): ActiveTransferToast[] {
  return list.filter((item) => item.code !== code);
}

export function getVisibleTransferToasts(
  list: ActiveTransferToast[],
  workbenchMinimized: boolean
): ActiveTransferToast[] {
  if (!workbenchMinimized) return [];
  return list.filter((item) => !item.dismissed);
}

export function formatToastHeadline(toast: ActiveTransferToast): string {
  const extra = toast.fileCount > 1 ? ` + ${toast.fileCount - 1} more` : '';
  return `${toast.firstFileName}${extra}`;
}

export function formatToastMeta(toast: ActiveTransferToast): string {
  const modeLabel = toast.mode === 'p2p' ? 'Direct (P2P)' : 'Upload';
  return `${modeLabel} · ${formatBytes(toast.totalBytes)}`;
}

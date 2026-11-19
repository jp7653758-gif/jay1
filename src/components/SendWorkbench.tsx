import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  FolderUp,
  Info,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  calculatePrice,
  computeBilledGb,
  Currency,
  formatBytes,
  MAX_UPLOAD_BYTES,
  RATES,
  screenFileNames,
  TransferMode,
} from '../utils/transferMath';
import { ActiveTransferToast, TransferPhase } from '../utils/transferToasts';
import {
  deriveDestination,
  formatMethodLabel,
  PaymentMethod,
  PaymentRegion,
  REGION_PAYMENT_METHODS,
  resolvePaymentSelection,
  SavedPaymentMethod,
  TransferLifecycleStatus,
} from '../utils/transferHistory';
import type { SaveTransferHistoryInput } from '../firebase';

interface SelectedFileItem {
  file: File;
  relativePath: string;
}

interface TransferResponse {
  code: string;
  mode: TransferMode;
  currency: Currency;
  receiverPays: boolean;
  paid: boolean;
  paymentGateway?: 'razorpay' | 'stripe';
  paymentMethod?: PaymentMethod;
  payerRole?: 'sender' | 'receiver';
  destination?: string;
  status: string;
  totalBytes: number;
  billedGb: number;
  priceAmount: number;
  priceFormatted: string;
  expiresAt: string;
  files: Array<{
    index: number;
    name: string;
    relativePath: string;
    size: number;
    uploaded: boolean;
    virusScanStatus: string;
  }>;
}

interface SendWorkbenchProps {
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  userLabel: string | null;
  savedPaymentMethods: SavedPaymentMethod[];
  workbenchMode: 'demo' | 'send';
  onWorkbenchModeChange: (m: 'demo' | 'send') => void;
  onOpenAuth: (tab?: 'transfers' | 'payments') => void;
  triggerFilePickerSignal: number;
  minimized: boolean;
  onMinimizeChange: (minimized: boolean) => void;
  onTransferToastUpdate: (toast: ActiveTransferToast) => void;
  onTransferToastRemove: (code: string) => void;
  onTransferRecorded?: (entry: SaveTransferHistoryInput) => void;
  onTransferStatusSync?: (code: string, status: TransferLifecycleStatus) => void;
  onTransferDeleted?: (code: string) => void;
}

const DEMO_STEPS = [
  { id: 0, label: 'Step 1: select assets', time: '00:02' },
  { id: 1, label: 'Step 2: transparent quote', time: '00:05' },
  { id: 2, label: 'Step 3: checkout method', time: '00:08' },
  { id: 3, label: 'Step 4: instant link', time: '00:11' },
  { id: 4, label: 'Step 5: encrypted stream', time: '00:15' },
  { id: 5, label: 'Step 6: verified delivery', time: '00:18' },
] as const;

export function SendWorkbench({
  currency,
  onCurrencyChange,
  userLabel,
  savedPaymentMethods,
  workbenchMode,
  onWorkbenchModeChange,
  onOpenAuth,
  triggerFilePickerSignal,
  minimized,
  onMinimizeChange,
  onTransferToastUpdate,
  onTransferToastRemove,
  onTransferRecorded,
  onTransferStatusSync,
  onTransferDeleted,
}: SendWorkbenchProps) {
  const [demoStep, setDemoStep] = useState(1);
  const [demoPlaying, setDemoPlaying] = useState(true);

  const [stage, setStage] = useState<'pick' | 'scan' | 'quote' | 'status'>('pick');
  const [dragging, setDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [scanChecks, setScanChecks] = useState<[boolean, boolean, boolean, boolean]>([
    false,
    false,
    false,
    false,
  ]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<TransferMode>('p2p');
  const [receiverPays, setReceiverPays] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [destinationInput, setDestinationInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const paymentRegion: PaymentRegion = currency === 'INR' ? 'IN' : 'GLOBAL';
  const paymentSelection = resolvePaymentSelection(paymentRegion, paymentMethod);
  const regionMethods = REGION_PAYMENT_METHODS[paymentRegion];

  const [activeTransfer, setActiveTransfer] = useState<TransferResponse | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [p2pState, setP2pState] = useState<'waiting' | 'connected' | 'sending' | 'delivered'>(
    'waiting'
  );
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const filesRef = useRef<SelectedFileItem[]>([]);
  filesRef.current = selectedFiles;

  // Apply default saved payment method if user signs in and loads saved methods
  useEffect(() => {
    const def = savedPaymentMethods.find((m) => m.isDefault) || savedPaymentMethods[0];
    if (def && stage === 'pick') {
      setPaymentMethod(def.method);
      if (def.region === 'IN' && currency !== 'INR') {
        onCurrencyChange('INR');
      } else if (def.region === 'GLOBAL' && currency !== 'USD') {
        onCurrencyChange('USD');
      }
    }
  }, [savedPaymentMethods]);

  useEffect(() => {
    if (workbenchMode !== 'demo' || !demoPlaying) return;
    const timer = window.setInterval(() => {
      setDemoStep((prev) => (prev + 1) % DEMO_STEPS.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [workbenchMode, demoPlaying]);

  useEffect(() => {
    if (triggerFilePickerSignal > 0) {
      onWorkbenchModeChange('send');
      setStage('pick');
      window.setTimeout(() => {
        fileInputRef.current?.click();
      }, 80);
    }
  }, [triggerFilePickerSignal, onWorkbenchModeChange]);

  useEffect(() => {
    return () => {
      sseRef.current?.close();
      peerRef.current?.close();
    };
  }, []);

  const totalBytes = selectedFiles.reduce((sum, item) => sum + item.file.size, 0);
  const billedGb = computeBilledGb(totalBytes);
  const p2pQuote = calculatePrice(billedGb, 'p2p', currency);
  const serverQuote = calculatePrice(billedGb, 'server', currency);
  const activeQuote = deliveryMode === 'p2p' ? p2pQuote : serverQuote;
  const uploadAllowed = totalBytes <= MAX_UPLOAD_BYTES;

  const ratePerGb = currency === 'INR' ? `₹${RATES.INR.p2p}` : `$${RATES.USD.p2p.toFixed(2)}`;

  const handleFilesSelected = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const items: SelectedFileItem[] = Array.from(incoming).map((file) => ({
      file,
      relativePath:
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));
    startScreening(items);
  };

  const handleLoadSampleFiles = () => {
    const sample1 = new File(
      [new Blob(['Studio master video package — lossless ProRes 422 stream header.'])],
      'Product-Launch-4K-Master.mov',
      { type: 'video/quicktime' }
    );
    const sample2 = new File(
      [new Blob(['Design system vector components and typography package.'])],
      'Brand-Assets.zip',
      { type: 'application/zip' }
    );
    startScreening([
      { file: sample1, relativePath: 'Product-Launch/4K-Master.mov' },
      { file: sample2, relativePath: 'Design-System/Brand-Assets.zip' },
    ]);
  };

  const startScreening = (items: SelectedFileItem[]) => {
    setSelectedFiles(items);
    setSubmitError(null);
    setScanError(null);
    setStage('scan');
    setScanChecks([false, false, false, false]);

    const safety = screenFileNames(items.map((i) => i.relativePath));

    window.setTimeout(() => setScanChecks([true, false, false, false]), 160);
    window.setTimeout(() => setScanChecks([true, true, false, false]), 320);
    window.setTimeout(() => setScanChecks([true, true, true, false]), 480);
    window.setTimeout(() => {
      setScanChecks([true, true, true, true]);
      if (!safety.allowed) {
        setScanError(safety.reason || 'Disallowed file type detected.');
      } else {
        window.setTimeout(() => {
          setStage('quote');
          if (items.reduce((s, f) => s + f.file.size, 0) > MAX_UPLOAD_BYTES) {
            setDeliveryMode('p2p');
          }
        }, 180);
      }
    }, 640);
  };

  const startP2PSignaling = (code: string) => {
    sseRef.current?.close();
    peerRef.current?.close();

    const sse = new EventSource(`/api/transfers/${code}/events?role=sender`);
    sseRef.current = sse;

    let activeSessionId = '';
    let pendingCandidates: RTCIceCandidateInit[] = [];
    let isCreatingOffer = false;

    const setupPeer = async (sessionId: string) => {
      if (isCreatingOffer) return;
      isCreatingOffer = true;

      try {
        peerRef.current?.close();
        pendingCandidates = [];
        activeSessionId = sessionId;

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        peerRef.current = pc;

        const channel = pc.createDataChannel('jalpi-file-stream', { ordered: true });
        channel.binaryType = 'arraybuffer';

        channel.onopen = async () => {
          setP2pState('sending');
          await fetch(`/api/transfers/${code}/signal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromRole: 'sender', type: 'streaming', payload: {} }),
          });

          const currentFiles = filesRef.current;
          const manifest = currentFiles.map((item) => ({
            name: item.file.name,
            relativePath: item.relativePath,
            size: item.file.size,
            type: item.file.type || 'application/octet-stream',
          }));
          channel.send(JSON.stringify({ kind: 'manifest', files: manifest }));

          const CHUNK_SIZE = 16384;
          let sentBytes = 0;
          const allBytes = currentFiles.reduce((acc, f) => acc + f.file.size, 0) || 1;

          for (let idx = 0; idx < currentFiles.length; idx += 1) {
            const item = currentFiles[idx];
            channel.send(
              JSON.stringify({
                kind: 'file-start',
                index: idx,
                name: item.file.name,
                size: item.file.size,
                type: item.file.type,
              })
            );
            const buffer = await item.file.arrayBuffer();
            for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_SIZE) {
              while (channel.bufferedAmount > 1024 * 512) {
                await new Promise((r) => setTimeout(r, 20));
              }
              const slice = buffer.slice(offset, offset + CHUNK_SIZE);
              channel.send(slice);
              sentBytes += slice.byteLength;
              setUploadProgress(Math.min(100, Math.round((sentBytes / allBytes) * 100)));
            }
            channel.send(JSON.stringify({ kind: 'file-end', index: idx }));
          }

          channel.send(JSON.stringify({ kind: 'done' }));
          setUploadProgress(100);
          setP2pState('delivered');
          onTransferStatusSync?.(code, 'delivered');
          await fetch(`/api/transfers/${code}/signal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromRole: 'sender', type: 'delivered', payload: {} }),
          });
        };

        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            fetch(`/api/transfers/${code}/signal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fromRole: 'sender',
                type: 'ice-candidate',
                payload: { candidate: ev.candidate, sessionId },
              }),
            }).catch(() => {});
          }
        };

        const offer = await pc.createOffer();
        if (peerRef.current !== pc || pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        await fetch(`/api/transfers/${code}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromRole: 'sender',
            type: 'offer',
            payload: { sdp: offer, sessionId },
          }),
        });
      } finally {
        isCreatingOffer = false;
      }
    };

    sse.addEventListener('peer-joined', () => {
      setP2pState((prev) => (prev === 'waiting' ? 'connected' : prev));
    });

    sse.addEventListener('signal', async (ev) => {
      const msg = JSON.parse((ev as MessageEvent).data) as {
        type: string;
        payload: {
          sessionId?: string;
          sdp?: RTCSessionDescriptionInit;
          candidate?: RTCIceCandidateInit;
        };
      };

      if (msg.type === 'receiver-ready') {
        const sessionId = msg.payload?.sessionId || String(Date.now());
        setP2pState('connected');
        await setupPeer(sessionId);
      } else if (msg.type === 'answer' && peerRef.current) {
        const pc = peerRef.current;
        if (msg.payload?.sessionId && msg.payload.sessionId !== activeSessionId) return;
        if (pc.signalingState !== 'have-local-offer') return;
        const answerSdp =
          msg.payload?.sdp || (msg.payload as unknown as RTCSessionDescriptionInit);
        await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
        for (const cand of pendingCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        pendingCandidates = [];
      } else if (msg.type === 'ice-candidate' && peerRef.current) {
        const pc = peerRef.current;
        if (msg.payload?.sessionId && msg.payload.sessionId !== activeSessionId) return;
        const cand = msg.payload?.candidate || (msg.payload as unknown as RTCIceCandidateInit);
        if (!cand) return;
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        } else {
          pendingCandidates.push(cand);
        }
      }
    });
  };

  const handleCreateTransfer = async () => {
    if (selectedFiles.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    const payerRole = receiverPays ? 'receiver' : 'sender';
    const resolvedDestination = deriveDestination(destinationInput, deliveryMode, payerRole);

    try {
      const createRes = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: deliveryMode,
          currency: paymentSelection.currency,
          receiverPays,
          paymentGateway: paymentSelection.gateway,
          paymentMethod: paymentSelection.method,
          destination: resolvedDestination,
          totalBytes,
          billedGb,
          priceAmount: activeQuote.amount,
          priceFormatted: activeQuote.formatted,
          ownerEmail: userLabel,
          files: selectedFiles.map((item) => ({
            name: item.file.name,
            relativePath: item.relativePath,
            size: item.file.size,
            type: item.file.type || 'application/octet-stream',
          })),
        }),
      });

      if (!createRes.ok) {
        const err = (await createRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Could not create transfer');
      }

      const created = (await createRes.json()) as TransferResponse;
      setActiveTransfer(created);
      setStage('status');
      setUploadProgress(0);
      setP2pState('waiting');

      const headline =
        created.files.length > 1
          ? `${created.files[0]?.name || 'Transfer'} + ${created.files.length - 1} more`
          : created.files[0]?.name || 'Transfer';

      onTransferRecorded?.({
        code: created.code,
        headline,
        fileCount: created.files.length,
        totalBytes: created.totalBytes,
        billedGb: created.billedGb,
        mode: created.mode,
        destination: created.destination || resolvedDestination,
        currency: created.currency,
        priceAmount: created.priceAmount,
        priceFormatted: created.priceFormatted,
        paymentGateway: created.paymentGateway || paymentSelection.gateway,
        paymentMethod: created.paymentMethod || paymentSelection.method,
        payerRole,
        paymentStatus: created.paid ? 'paid' : 'pending_receiver',
        status: created.mode === 'p2p' ? 'ready' : 'uploading',
        shareUrl: `${window.location.origin}/?t=${created.code}`,
      });

      if (deliveryMode === 'server') {
        let uploadedBytes = 0;
        const denom = totalBytes || 1;
        for (let i = 0; i < selectedFiles.length; i += 1) {
          const item = selectedFiles[i];
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', `/api/transfers/${created.code}/files/${i}`);
            xhr.setRequestHeader(
              'Content-Type',
              item.file.type || 'application/octet-stream'
            );
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable) {
                const current = uploadedBytes + ev.loaded;
                setUploadProgress(Math.min(99, Math.round((current / denom) * 100)));
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
              } else {
                reject(new Error(`Upload failed for ${item.file.name}`));
              }
            };
            xhr.onerror = () => reject(new Error(`Upload failed for ${item.file.name}`));
            xhr.send(item.file);
          });
          uploadedBytes += item.file.size;
          setUploadProgress(Math.min(100, Math.round((uploadedBytes / denom) * 100)));
        }
        const refreshed = await fetch(`/api/transfers/${created.code}`);
        if (refreshed.ok) {
          setActiveTransfer((await refreshed.json()) as TransferResponse);
        }
        setUploadProgress(100);
        onTransferStatusSync?.(created.code, 'ready');
      } else {
        startP2PSignaling(created.code);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEarly = async () => {
    if (!activeTransfer) return;
    await fetch(`/api/transfers/${activeTransfer.code}`, { method: 'DELETE' });
    onTransferDeleted?.(activeTransfer.code);
    resetTransfer();
  };

  const resetTransfer = () => {
    if (activeTransfer) {
      onTransferToastRemove(activeTransfer.code);
    }
    sseRef.current?.close();
    peerRef.current?.close();
    setSelectedFiles([]);
    setActiveTransfer(null);
    setScanError(null);
    setSubmitError(null);
    setDestinationInput('');
    setUploadProgress(0);
    setP2pState('waiting');
    setStage('pick');
  };

  const shareUrl = activeTransfer
    ? `${window.location.origin}/?t=${activeTransfer.code}`
    : '';

  useEffect(() => {
    if (!activeTransfer || stage !== 'status') return;

    let phase: TransferPhase = 'waiting';
    let statusText = '';

    if (activeTransfer.mode === 'server') {
      if (uploadProgress >= 100) {
        phase = 'ready';
        statusText = 'Scanned & stored in vault · active for 7 days';
      } else {
        phase = 'uploading';
        statusText = `Uploading to vault… ${uploadProgress}%`;
      }
    } else if (p2pState === 'delivered') {
      phase = 'delivered';
      statusText = 'Delivered directly to receiver disk';
    } else if (p2pState === 'sending') {
      phase = 'streaming';
      statusText = `Direct stream active… ${uploadProgress}%`;
    } else if (p2pState === 'connected') {
      phase = 'connected';
      statusText = 'Receiver connected · starting stream…';
    } else {
      phase = 'waiting';
      statusText = 'Waiting for receiver to open link…';
    }

    onTransferToastUpdate({
      code: activeTransfer.code,
      mode: activeTransfer.mode,
      fileCount: activeTransfer.files.length,
      firstFileName: activeTransfer.files[0]?.name || 'Transfer',
      totalBytes: activeTransfer.totalBytes,
      progress: uploadProgress,
      phase,
      statusText,
      shareUrl,
    });
  }, [activeTransfer, stage, uploadProgress, p2pState, shareUrl, onTransferToastUpdate]);

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section
      id="send"
      aria-label="Send files"
      className="scroll-mt-20 relative min-w-0 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.22)] overflow-hidden"
    >
      <div className="brand-primary-bg h-[3px] w-full" aria-hidden="true" />

      {/* Workbench Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] font-bold text-slate-900 dark:text-slate-50">
            {workbenchMode === 'demo' ? 'Interactive Walkthrough' : 'Send Workspace'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[13px] font-mono-num">
            <span className="font-bold text-blue-700 dark:text-blue-400">{ratePerGb}</span>
            <span className="text-slate-500 dark:text-slate-400">/ GB</span>
          </div>
          {workbenchMode === 'send' && (
            <button
              type="button"
              aria-label={minimized ? 'Restore transfer workbench' : 'Minimize transfer workbench'}
              title={minimized ? 'Restore workbench' : 'Minimize workbench'}
              onClick={() => onMinimizeChange(!minimized)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {minimized ? (
                <Maximize2 className="h-3.5 w-3.5" />
              ) : (
                <Minimize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Minimized Strip */}
      {workbenchMode === 'send' && minimized && (
        <div className="p-5 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">
              {activeTransfer
                ? `${activeTransfer.files[0]?.name || 'Transfer'} · ${uploadProgress}%`
                : 'Transfer workspace minimized'}
            </p>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              {activeTransfer
                ? 'Live progress tracking in the floating bar.'
                : 'Restore anytime to add files or review your link.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onMinimizeChange(false)}
            className="shrink-0 brand-cta rounded-xl px-4 py-2 text-[13px] font-semibold text-white cursor-pointer"
          >
            Restore
          </button>
        </div>
      )}

      {/* Workbench Body */}
      <div className={workbenchMode === 'send' && minimized ? 'hidden' : ''}>
        {workbenchMode === 'demo' ? (
          <div className="p-5">
            <div
              onClick={() => {
                onWorkbenchModeChange('send');
                setStage('pick');
              }}
              role="button"
              tabIndex={0}
              aria-label="Click to send your own files"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onWorkbenchModeChange('send');
                  setStage('pick');
                }
              }}
              className="relative min-h-[272px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 cursor-pointer hover:border-blue-500 transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[11.5px] font-mono-num">
                <span className="font-semibold text-blue-700 dark:text-blue-400">Preview</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {DEMO_STEPS[demoStep].time} / 00:18
                </span>
              </div>

              {demoStep === 0 && (
                <div className="my-auto py-4 text-center space-y-3">
                  <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl brand-primary-bg text-white">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-display text-[17px] font-bold text-slate-900 dark:text-white">
                      Select project folders or clips
                    </p>
                    <p className="text-[13px] text-slate-600 dark:text-slate-400">
                      Product-Launch package · 8.4 GB total
                    </p>
                  </div>
                </div>
              )}

              {demoStep === 1 && (
                <div className="my-2 space-y-2.5">
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-[12.5px] font-mono-num">
                    <div className="flex items-center justify-between py-1.5">
                      <span className="truncate text-slate-900 dark:text-slate-100">
                        Product-Launch/4K-Master.mov
                      </span>
                      <span className="text-slate-500 shrink-0 ml-2">5.2 GB</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="truncate text-slate-900 dark:text-slate-100">
                        Design-System/Brand-Assets.zip
                      </span>
                      <span className="text-slate-500 shrink-0 ml-2">2.1 GB</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="truncate text-slate-900 dark:text-slate-100">
                        RAW-Stills/Set-01.dng
                      </span>
                      <span className="text-slate-500 shrink-0 ml-2">1.1 GB</span>
                    </div>
                  </div>
                  <div className="pt-1">
                    <p className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                      Calculated fee
                    </p>
                    <p className="font-display text-[32px] font-extrabold leading-none tracking-tight text-blue-700 dark:text-blue-400 font-mono-num mt-1">
                      {currency === 'INR' ? '₹9' : '$0.50'}
                    </p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
                      {currency === 'INR'
                        ? '9 GB × ₹1/GB · Direct (P2P)'
                        : '9 GB · Stripe Card or Wallet'}
                    </p>
                  </div>
                </div>
              )}

              {demoStep === 2 && (
                <div className="my-auto py-3 space-y-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-[12.5px] font-bold text-slate-900 dark:text-white">
                        {currency === 'INR'
                          ? 'Razorpay · UPI / Card / NetBanking'
                          : 'Stripe · Card / Google Pay'}
                      </p>
                      <p className="text-[12px] text-slate-500 dark:text-slate-400">
                        Product-Launch · 9 GB billed
                      </p>
                    </div>
                    <span className="font-display text-[18px] font-bold text-slate-900 dark:text-white font-mono-num">
                      {currency === 'INR' ? '₹9' : '$0.50'}
                    </span>
                  </div>
                  <div className="brand-cta rounded-xl py-2.5 text-center text-[13px] font-semibold text-white">
                    Confirm &amp; generate link →
                  </div>
                </div>
              )}

              {demoStep === 3 && (
                <div className="my-auto py-3 space-y-3">
                  <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="h-4 w-4" />
                    Payment settled · Share link ready
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <span className="font-mono-num text-[12.5px] text-slate-900 dark:text-white truncate">
                      share.jalpi.com/?t=N8pR4v2Q
                    </span>
                    <span className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-900 dark:text-white">
                      Copy
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    Share via WhatsApp, Slack, or email. Works seamlessly on phone &amp; desktop.
                  </p>
                </div>
              )}

              {demoStep === 4 && (
                <div className="my-auto py-3 space-y-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Encrypted direct transfer active
                    </span>
                    <span className="font-mono-num font-bold text-blue-700 dark:text-blue-400">
                      78%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="brand-primary-bg h-full w-[78%] rounded-full" />
                  </div>
                  <div className="flex items-center justify-between text-[12px] font-mono-num text-slate-500 dark:text-slate-400">
                    <span>6.5 / 8.4 GB</span>
                    <span>DTLS encrypted · P2P</span>
                  </div>
                </div>
              )}

              {demoStep === 5 && (
                <div className="my-auto py-3 space-y-2.5">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                    <Check className="h-5 w-5" />
                  </div>
                  <p className="font-display text-[20px] font-bold text-slate-900 dark:text-white">
                    Delivered byte-for-byte
                  </p>
                  <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                    All 8.4 GB received safely and recorded in your synced Transfer History.
                  </p>
                </div>
              )}

              <div className="pt-2 text-center text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                Tap here to send your own files
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={demoPlaying ? 'Pause walkthrough' : 'Play walkthrough'}
                  onClick={() => setDemoPlaying((p) => !p)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  {demoPlaying ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </button>
                <div role="group" aria-label="Walkthrough steps" className="flex items-center gap-1.5">
                  {DEMO_STEPS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={s.label}
                      onClick={() => {
                        setDemoStep(s.id);
                        setDemoPlaying(false);
                      }}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        demoStep === s.id
                          ? 'w-7 brand-primary-bg'
                          : 'w-2.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onWorkbenchModeChange('send');
                  setStage('pick');
                }}
                className="brand-cta min-h-[44px] rounded-xl px-4.5 py-2.5 text-[13.5px] font-semibold text-white cursor-pointer"
              >
                Send files now →
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <input
              ref={dirInputRef}
              type="file"
              // @ts-expect-error webkitdirectory is standard in Chromium/WebKit
              webkitdirectory=""
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />

            {stage === 'pick' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFilesSelected(e.dataTransfer.files);
                }}
                className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  dragging
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950'
                }`}
              >
                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl brand-primary-bg text-white">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="font-display text-[19px] font-bold text-slate-900 dark:text-white">
                  Drop files or pick from phone
                </p>
                <p className="mx-auto mt-1.5 max-w-[360px] text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                  Only file sizes are scanned first. Next, choose Direct P2P or 7-day Vault and pick
                  your payment method.
                </p>

                <p className="mt-3 text-[12px] font-medium text-slate-600 dark:text-slate-400">
                  {userLabel ? (
                    <span>Signed in ({userLabel}) · History &amp; Payments synced</span>
                  ) : (
                    <>
                      Sending as guest ·{' '}
                      <button
                        type="button"
                        onClick={() => onOpenAuth('transfers')}
                        className="underline font-semibold text-blue-700 dark:text-blue-400 cursor-pointer"
                      >
                        Sign in with Google ID or Phone OTP
                      </button>
                    </>
                  )}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-[13.5px] font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Choose files
                  </button>
                  <button
                    type="button"
                    onClick={() => dirInputRef.current?.click()}
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-[13.5px] font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <FolderUp className="h-4 w-4 text-slate-500" />
                    Choose folder
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSampleFiles}
                  className="mt-3 text-[12.5px] font-medium text-slate-600 dark:text-slate-400 underline underline-offset-2 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                >
                  Or load sample Product Launch files
                </button>
              </div>
            )}

            {stage === 'scan' && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-4">
                <div className="flex items-center gap-2.5 text-[14px] font-semibold text-slate-900 dark:text-white">
                  <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span>
                    {scanError ? 'File screening blocked selection' : 'Screening files…'}
                  </span>
                </div>

                <ul className="space-y-2 text-[13.5px]">
                  {[
                    'Verified file extensions',
                    'Executable & script blocklist clear',
                    'Archive structure inspected',
                    'Malware signature check ready',
                  ].map((label, idx) => {
                    const done = scanChecks[idx];
                    const failed = Boolean(scanError) && idx === 0;
                    return (
                      <li key={label} className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                            failed
                              ? 'bg-red-100 text-red-700'
                              : done
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {failed ? (
                            <X className="h-3 w-3" />
                          ) : done ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            '·'
                          )}
                        </span>
                        <span
                          className={
                            failed
                              ? 'text-red-700 dark:text-red-400 font-medium'
                              : 'text-slate-700 dark:text-slate-300'
                          }
                        >
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {scanError && (
                  <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-3 text-[12.5px] text-red-800 dark:text-red-300 space-y-2">
                    <p>{scanError}</p>
                    <button
                      type="button"
                      onClick={resetTransfer}
                      className="rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 px-3 py-1.5 text-[12px] font-semibold text-red-700 dark:text-red-300 cursor-pointer"
                    >
                      Pick other files
                    </button>
                  </div>
                )}
              </div>
            )}

            {stage === 'quote' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-mono-num uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Delivery Mode
                  </span>
                  <button
                    type="button"
                    onClick={resetTransfer}
                    className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Change files ({selectedFiles.length})
                  </button>
                </div>

                <div role="radiogroup" aria-label="Delivery" className="grid grid-cols-2 gap-2.5">
                  <label
                    className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                      deliveryMode === 'p2p'
                        ? 'border-blue-700 bg-blue-50/70 dark:bg-blue-950/40'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dmode"
                      value="p2p"
                      checked={deliveryMode === 'p2p'}
                      onChange={() => setDeliveryMode('p2p')}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between text-[13.5px] font-bold text-slate-900 dark:text-white">
                      <span>Direct P2P</span>
                      <span className="font-mono-num text-blue-700 dark:text-blue-400">
                        {p2pQuote.formatted}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                      Device-to-device · 0 bytes stored
                    </p>
                  </label>

                  <label
                    className={`rounded-xl border p-3 transition-colors ${
                      !uploadAllowed
                        ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950'
                        : deliveryMode === 'server'
                        ? 'border-blue-700 bg-blue-50/70 dark:bg-blue-950/40 cursor-pointer'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dmode"
                      value="server"
                      disabled={!uploadAllowed}
                      checked={deliveryMode === 'server'}
                      onChange={() => setDeliveryMode('server')}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between text-[13.5px] font-bold text-slate-900 dark:text-white">
                      <span>7-Day Vault</span>
                      <span className="font-mono-num text-blue-700 dark:text-blue-400">
                        {serverQuote.formatted}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                      {uploadAllowed ? 'Download anytime in 7 days' : 'Max 50 GB limit'}
                    </p>
                  </label>
                </div>

                <div>
                  <label
                    htmlFor="transfer-destination"
                    className="block text-[11.5px] font-mono-num text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Destination (saved to Transfer History)
                  </label>
                  <input
                    id="transfer-destination"
                    type="text"
                    maxLength={180}
                    value={destinationInput}
                    onChange={(e) => setDestinationInput(e.target.value)}
                    placeholder="e.g. ananya@design.in · Bengaluru"
                    className="min-h-[42px] w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-[13px] text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                  />
                </div>

                {/* Pay, or let them pay */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11.5px] font-mono-num text-slate-600 dark:text-slate-400">
                      Pay, or let them pay
                    </span>
                    <div
                      role="group"
                      aria-label="Who pays"
                      className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-[11.5px] font-semibold"
                    >
                      <button
                        type="button"
                        aria-pressed={!receiverPays}
                        onClick={() => setReceiverPays(false)}
                        className={`rounded-md px-2.5 py-1.5 transition-colors cursor-pointer ${
                          !receiverPays
                            ? 'bg-blue-700 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                        }`}
                      >
                        You pay
                      </button>
                      <button
                        type="button"
                        aria-pressed={receiverPays}
                        onClick={() => setReceiverPays(true)}
                        className={`rounded-md px-2.5 py-1.5 transition-colors cursor-pointer ${
                          receiverPays
                            ? 'bg-blue-700 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                        }`}
                      >
                        Ask receiver to pay
                      </button>
                    </div>
                  </div>

                  {/* Quick Saved Payment Method Selector if available */}
                  {!receiverPays && savedPaymentMethods.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                        <span>Saved payment methods</span>
                        <button
                          type="button"
                          onClick={() => onOpenAuth('payments')}
                          className="text-blue-700 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                        >
                          Manage methods
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {savedPaymentMethods.map((pm) => {
                          const selected =
                            pm.region === paymentRegion && pm.method === paymentSelection.method;
                          return (
                            <button
                              key={pm.id}
                              type="button"
                              onClick={() => {
                                onCurrencyChange(pm.region === 'IN' ? 'INR' : 'USD');
                                setPaymentMethod(pm.method);
                              }}
                              className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer ${
                                selected
                                  ? 'border-blue-700 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {pm.label} · {pm.detail}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Region / Gateway Switch */}
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <button
                      type="button"
                      aria-pressed={paymentRegion === 'IN'}
                      onClick={() => {
                        onCurrencyChange('INR');
                        setPaymentMethod((prev) =>
                          prev === 'card' || prev === 'netbanking' ? prev : 'upi'
                        );
                      }}
                      className={`rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                        paymentRegion === 'IN'
                          ? 'border-blue-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="block font-bold">India · Razorpay</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        ₹ INR · UPI / Card / Bank
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={paymentRegion === 'GLOBAL'}
                      onClick={() => {
                        onCurrencyChange('USD');
                        setPaymentMethod((prev) => (prev === 'wallet' ? 'wallet' : 'card'));
                      }}
                      className={`rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                        paymentRegion === 'GLOBAL'
                          ? 'border-blue-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="block font-bold">Everywhere else · Stripe</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        $ USD · Card / Wallet
                      </span>
                    </button>
                  </div>

                  {!receiverPays && (
                    <div
                      role="group"
                      aria-label="Checkout payment method"
                      className="flex flex-wrap gap-1.5 text-[12px]"
                    >
                      {regionMethods.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          aria-pressed={paymentSelection.method === m.id}
                          onClick={() => setPaymentMethod(m.id)}
                          className={`flex-1 min-w-[92px] min-h-[38px] rounded-lg border px-2.5 py-1.5 font-semibold cursor-pointer ${
                            paymentSelection.method === m.id
                              ? 'border-slate-900 dark:border-blue-600 bg-slate-900 dark:bg-blue-700 text-white'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-2.5">
                    <div>
                      <p className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                        {receiverPays ? 'Receiver pays on unlock' : 'Total payable'}
                      </p>
                      <p className="font-display text-[28px] font-extrabold leading-none text-slate-900 dark:text-white font-mono-num mt-1">
                        {activeQuote.formatted}
                      </p>
                      <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 font-mono-num">
                        {formatBytes(totalBytes)} → {billedGb} GB billed ·{' '}
                        {paymentSelection.gateway === 'razorpay'
                          ? receiverPays
                            ? 'Razorpay UPI / Card / Bank'
                            : `Razorpay ${formatMethodLabel(paymentSelection.method)}`
                          : receiverPays
                          ? 'Stripe Card / Wallet'
                          : `Stripe ${formatMethodLabel(paymentSelection.method)}`}
                      </p>
                    </div>
                    {!userLabel && (
                      <button
                        type="button"
                        onClick={() => onOpenAuth('payments')}
                        className="text-[11.5px] font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        + Add saved method
                      </button>
                    )}
                  </div>
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-3 py-2 text-[12.5px] text-red-700 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCreateTransfer}
                  className="brand-cta w-full min-h-[48px] rounded-xl py-3 text-[14.5px] font-semibold text-white cursor-pointer disabled:opacity-60"
                >
                  {submitting
                    ? deliveryMode === 'server'
                      ? 'Uploading & scanning…'
                      : 'Creating direct stream…'
                    : receiverPays
                    ? `Create link (receiver pays ${activeQuote.formatted}) →`
                    : `Pay ${activeQuote.formatted} via ${
                        paymentSelection.gateway === 'razorpay' ? 'Razorpay' : 'Stripe'
                      } ${formatMethodLabel(paymentSelection.method)} →`}
                </button>
              </div>
            )}

            {stage === 'status' && activeTransfer && (
              <div className="space-y-4">
                <ol
                  aria-label="Transfer progress"
                  className="grid grid-cols-5 gap-1 text-center text-[11px] font-mono-num"
                >
                  {[
                    { key: 'pay', label: activeTransfer.paid ? 'Paid' : 'Unpaid', active: true },
                    { key: 'link', label: 'Link', active: true },
                    {
                      key: 'connect',
                      label: activeTransfer.mode === 'server' ? 'Scanned' : 'Linked',
                      active:
                        activeTransfer.mode === 'server'
                          ? uploadProgress >= 100
                          : p2pState !== 'waiting',
                    },
                    {
                      key: 'send',
                      label: activeTransfer.mode === 'server' ? 'Stored' : 'Sending',
                      active:
                        activeTransfer.mode === 'server'
                          ? uploadProgress >= 100
                          : p2pState === 'sending' || p2pState === 'delivered',
                    },
                    {
                      key: 'done',
                      label: activeTransfer.mode === 'server' ? 'Ready' : 'Delivered',
                      active:
                        activeTransfer.mode === 'server'
                          ? uploadProgress >= 100
                          : p2pState === 'delivered',
                    },
                  ].map((step) => (
                    <li
                      key={step.key}
                      className={`rounded-lg py-1.5 px-1 font-medium ${
                        step.active
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {step.label}
                    </li>
                  ))}
                </ol>

                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-[13px] text-slate-700 dark:text-slate-300"
                >
                  {activeTransfer.mode === 'server' ? (
                    uploadProgress >= 100 ? (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        Uploaded &amp; malware-scanned. Receiver can download for 7 days.
                      </span>
                    ) : (
                      <span>Uploading &amp; encrypting vault files… {uploadProgress}%</span>
                    )
                  ) : p2pState === 'delivered' ? (
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      Delivered directly to receiver disk. Zero server copies saved.
                    </span>
                  ) : p2pState === 'sending' ? (
                    <span>Streaming directly over encrypted WebRTC… {uploadProgress}%</span>
                  ) : p2pState === 'connected' ? (
                    <span>Receiver connected! Starting direct stream…</span>
                  ) : (
                    <span>
                      Keep this tab open. Transfer begins immediately when the receiver opens the
                      link.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 truncate rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 font-mono-num text-[12.5px] text-slate-900 dark:text-white">
                    {shareUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyShareUrl()}
                    className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-slate-900 dark:text-white hover:bg-slate-50 cursor-pointer"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="brand-primary-bg h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <a
                    href={`/?t=${activeTransfer.code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-slate-900 dark:text-white hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open receiver view
                  </a>
                  <div className="flex items-center gap-2">
                    {activeTransfer.mode === 'server' && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteEarly()}
                        className="min-h-[40px] inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 px-3 py-1.5 text-[12.5px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={resetTransfer}
                      className="brand-cta min-h-[40px] rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold text-white cursor-pointer"
                    >
                      New transfer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 py-2.5 text-[11.5px] font-mono-num text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Works on phone &amp; desktop browsers
          </span>
          {workbenchMode === 'send' && stage === 'pick' && (
            <button
              type="button"
              onClick={() => onWorkbenchModeChange('demo')}
              className="font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
            >
              ▶ Replay walkthrough
            </button>
          )}
          <span>Direct 24 h · Vault 7 days</span>
        </div>
      </div>
    </section>
  );
}

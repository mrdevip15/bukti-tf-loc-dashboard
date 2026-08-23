const assert = require('node:assert/strict');
const { afterEach, beforeEach, test } = require('node:test');
const { createApp, parseLocation, parsePhoto } = require('../server');

let server;
let baseUrl;
let sentMessages;
let sentPhotos;

beforeEach(async () => {
  sentMessages = [];
  sentPhotos = [];
  const telegramClient = {
    async sendMessage(message) { sentMessages.push(message); },
    async sendPhoto(buffer, metadata) { sentPhotos.push({ buffer, metadata }); }
  };
  server = createApp({ telegramClient }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise(resolve => server.close(resolve));
});

async function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function verification(overrides = {}) {
  return {
    name: 'Internal User',
    phone: '+62 812 0000 0000',
    location: { latitude: -8.65, longitude: 115.22, accuracy: 12 },
    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    consent: true,
    photoCount: 10,
    ...overrides
  };
}

test('health endpoint reports the ten-photo limit and security headers', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, telegram: true, maxPhotos: 10 });
  assert.match(response.headers.get('permissions-policy'), /camera=\(self\)/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('player page is public-facing content and admin generator is isolated by route', async () => {
  const playerResponse = await fetch(`${baseUrl}/`);
  const playerHtml = await playerResponse.text();
  assert.equal(playerResponse.status, 200);
  assert.match(playerHtml, /Verifikasi Pemain/);
  assert.doesNotMatch(playerHtml, /Transfer Receipt Generator/);

  const adminResponse = await fetch(`${baseUrl}/admin`);
  const adminHtml = await adminResponse.text();
  assert.equal(adminResponse.status, 200);
  assert.match(adminHtml, /Transfer Receipt Generator/);

  const sourceResponse = await fetch(`${baseUrl}/server.js`);
  assert.equal(sourceResponse.status, 404);

  const fontResponse = await fetch(`${baseUrl}/assets/ArchivoBlack-Regular.ttf`);
  assert.equal(fontResponse.status, 200);
  assert.equal(fontResponse.headers.get('content-type'), 'font/ttf');
  assert.match(fontResponse.headers.get('cache-control'), /immutable/);
});

test('verification requires explicit consent', async () => {
  const response = await post('/api/verify', verification({ consent: false }));
  assert.equal(response.status, 400);
  assert.equal(sentMessages.length, 0);
});

test('identity and location are delivered after consent', async () => {
  const response = await post('/api/verify', verification());
  assert.equal(response.status, 200);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /Internal User/);
  assert.match(sentMessages[0], /explicitly accepted/);
  assert.match(sentMessages[0], /google\.com\/maps/);
});

test('capture accepts JPEG data and enforces a maximum of ten photos', async () => {
  await post('/api/verify', verification());
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;
  for (let index = 0; index < 10; index += 1) {
    const response = await post('/api/capture', {
      sessionId: verification().sessionId,
      img: jpeg
    });
    assert.equal(response.status, 200);
  }
  const overflow = await post('/api/capture', {
    sessionId: verification().sessionId,
    img: jpeg
  });
  assert.equal(overflow.status, 409);
  assert.equal(sentPhotos.length, 10);
});

test('parsers reject malformed location and non-JPEG input', () => {
  assert.equal(parseLocation({ latitude: 100, longitude: 10 }), null);
  assert.equal(parsePhoto('data:image/png;base64,AAAA'), null);
  assert.equal(parsePhoto('data:image/jpeg;base64,YWJj'), null);
});

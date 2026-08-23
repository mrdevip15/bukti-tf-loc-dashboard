const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, test } = require('node:test');
const {
  createApp,
  createInvoiceStore,
  createMemoryInvoiceStore,
  parseInvoice,
  parseLocation,
  parsePhoto
} = require('../server');

let server;
let baseUrl;
let sentMessages;
let sentPhotos;
let invoiceStore;
let invoiceRecord;
let failPhotoAt;
let telegramClient;

const ADMIN_AUTH = 'Basic dGVzdC1hZG1pbjp0ZXN0LXBhc3N3b3Jk';
const ADMIN_AUTH_SHA256 = crypto.createHash('sha256').update(ADMIN_AUTH).digest('hex');

function invoice(overrides = {}) {
  return {
    greetName: 'MUHAMMAD',
    nominal: '2.000.000,00',
    metode: 'BI-Fast',
    biaya: 'Rp2.500,00',
    biayaStatus: 'Free',
    total: '2.000.000,00',
    sumberDana: 'Wallet · Fluid Asset GG',
    penerimaNama: 'Muhammad Hidayat',
    penerimaBank: 'BANK CENTRAL ASIA · 8120900200',
    tujuan: 'Fund Transfer',
    tanggal: '22 Aug 2026, 15:23 WIB',
    idTransaksi: '260822AI8GSS5F',
    noReferensi: '2026082200012345',
    ...overrides
  };
}

beforeEach(async () => {
  sentMessages = [];
  sentPhotos = [];
  failPhotoAt = null;
  telegramClient = {
    async sendMessage(message) { sentMessages.push(message); },
    async sendPhoto(buffer, metadata) {
      if (failPhotoAt === sentPhotos.length + 1) {
        failPhotoAt = null;
        throw new Error('Injected Telegram photo failure');
      }
      sentPhotos.push({ buffer, metadata });
    }
  };
  invoiceStore = createMemoryInvoiceStore();
  invoiceRecord = invoiceStore.create(invoice());
  server = createApp({
    env: { ADMIN_AUTH_SHA256 },
    telegramClient,
    invoiceStore
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise(resolve => server.close(resolve));
});

async function post(path, body, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
}

function verification(overrides = {}) {
  return {
    name: 'Internal User',
    phone: '+62 812 0000 0000',
    invoiceId: invoiceRecord.id,
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
  assert.deepEqual(await response.json(), { ok: true, telegram: true, invoiceLinks: true, maxPhotos: 10 });
  assert.match(response.headers.get('permissions-policy'), /camera=\(self\)/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('linked player page is public-facing content and admin generator is isolated by route', async () => {
  const playerResponse = await fetch(`${baseUrl}/i/${invoiceRecord.id}`);
  const playerHtml = await playerResponse.text();
  assert.equal(playerResponse.status, 200);
  assert.match(playerHtml, /Konfirmasi Invoice/);
  assert.doesNotMatch(playerHtml, /Simpan &amp; buat link/);

  const adminResponse = await fetch(`${baseUrl}/admin`, { headers: { Authorization: ADMIN_AUTH } });
  const adminHtml = await adminResponse.text();
  assert.equal(adminResponse.status, 200);
  assert.match(adminHtml, /Invoice Admin/);
  assert.match(adminHtml, /Simpan &amp; buat link/);

  const sourceResponse = await fetch(`${baseUrl}/server.js`);
  assert.equal(sourceResponse.status, 404);

  const fontResponse = await fetch(`${baseUrl}/assets/ArchivoBlack-Regular.ttf`);
  assert.equal(fontResponse.status, 200);
  assert.equal(fontResponse.headers.get('content-type'), 'font/ttf');
  assert.match(fontResponse.headers.get('cache-control'), /immutable/);
});

test('admin authentication is enforced inside the app', async () => {
  const pageResponse = await fetch(`${baseUrl}/admin`);
  const apiResponse = await post('/api/admin/invoices', invoice());
  assert.equal(pageResponse.status, 401);
  assert.equal(apiResponse.status, 401);
});

test('admin can create a persistent-style invoice link and player can load its exact data', async () => {
  const createResponse = await post(
    '/api/admin/invoices',
    invoice({ nominal: '7.500.000,00' }),
    { Authorization: ADMIN_AUTH }
  );
  const created = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.match(created.id, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(created.path, `/i/${created.id}`);

  const loadResponse = await fetch(`${baseUrl}/api/invoices/${created.id}`);
  const loaded = await loadResponse.json();
  assert.equal(loadResponse.status, 200);
  assert.equal(loaded.invoice.nominal, '7.500.000,00');
  assert.equal(loaded.invoice.penerimaNama, 'Muhammad Hidayat');
  assert.equal(loaded.verifiedAt, null);
});

test('verification requires explicit consent', async () => {
  const response = await post('/api/verify', verification({ consent: false }));
  assert.equal(response.status, 400);
  assert.equal(sentMessages.length, 0);
});

test('verification requires a valid generated invoice link', async () => {
  const response = await post('/api/verify', verification({ invoiceId: 'invalid' }));
  assert.equal(response.status, 400);
  assert.equal(sentMessages.length, 0);
});

test('identity and location are delivered after consent', async () => {
  const response = await post('/api/verify', verification());
  assert.equal(response.status, 200);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /Internal User/);
  assert.match(sentMessages[0], /260822AI8GSS5F/);
  assert.match(sentMessages[0], /Muhammad Hidayat/);
  assert.match(sentMessages[0], /explicitly accepted/);
  assert.match(sentMessages[0], /google\.com\/maps/);
});

test('capture accepts JPEG data and enforces a maximum of ten photos', async () => {
  await post('/api/verify', verification());
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;
  for (let index = 0; index < 10; index += 1) {
    const response = await post('/api/capture', {
      sessionId: verification().sessionId,
      img: jpeg,
      photoIndex: index + 1
    });
    assert.equal(response.status, 200);
  }
  const overflow = await post('/api/capture', {
    sessionId: verification().sessionId,
    img: jpeg,
    photoIndex: 11
  });
  assert.equal(overflow.status, 400);
  assert.equal(sentPhotos.length, 10);

  const invoiceResponse = await fetch(`${baseUrl}/api/invoices/${invoiceRecord.id}`);
  const completed = await invoiceResponse.json();
  assert.ok(completed.verifiedAt);

  const repeated = await post('/api/verify', verification({ sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }));
  assert.equal(repeated.status, 409);
});

test('failed Telegram delivery does not advance photo count or verify the invoice', async () => {
  await post('/api/verify', verification({ photoCount: 3 }));
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;

  const first = await post('/api/capture', { sessionId: verification().sessionId, img: jpeg, photoIndex: 1 });
  assert.equal(first.status, 200);

  failPhotoAt = 2;
  const failed = await post('/api/capture', { sessionId: verification().sessionId, img: jpeg, photoIndex: 2 });
  assert.equal(failed.status, 502);
  assert.equal(sentPhotos.length, 1);
  assert.equal(invoiceStore.get(invoiceRecord.id).verifiedAt, null);

  const retry = await post('/api/capture', { sessionId: verification().sessionId, img: jpeg, photoIndex: 2 });
  const final = await post('/api/capture', { sessionId: verification().sessionId, img: jpeg, photoIndex: 3 });
  assert.equal(retry.status, 200);
  assert.equal(final.status, 200);
  assert.equal(sentPhotos.length, 3);
  assert.ok(invoiceStore.get(invoiceRecord.id).verifiedAt);

  const duplicate = await post('/api/capture', { sessionId: verification().sessionId, img: jpeg, photoIndex: 3 });
  assert.equal(duplicate.status, 200);
  assert.equal(sentPhotos.length, 3);
});

test('remaining photos can be renumbered after an application restart', async () => {
  await post('/api/verify', verification({ photoCount: 3 }));
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;
  const first = await post('/api/capture', { sessionId: verification().sessionId, img: jpeg, photoIndex: 1 });
  assert.equal(first.status, 200);

  await new Promise(resolve => server.close(resolve));
  server = createApp({
    env: { ADMIN_AUTH_SHA256 },
    telegramClient,
    invoiceStore
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const resumedVerification = await post('/api/verify', verification({ photoCount: 2 }));
  const resumedBody = await resumedVerification.json();
  assert.equal(resumedVerification.status, 200);
  assert.equal(resumedBody.resumed, undefined);

  const remainingFirst = await post('/api/capture', { sessionId: verification().sessionId, img: jpeg, photoIndex: 1 });
  const remainingFinal = await post('/api/capture', { sessionId: verification().sessionId, img: jpeg, photoIndex: 2 });
  assert.equal(remainingFirst.status, 200);
  assert.equal(remainingFinal.status, 200);
  assert.ok(invoiceStore.get(invoiceRecord.id).verifiedAt);
  assert.equal(sentPhotos.length, 3);
});

test('parsers reject malformed location and non-JPEG input', () => {
  assert.equal(parseLocation({ latitude: 100, longitude: 10 }), null);
  assert.equal(parsePhoto('data:image/png;base64,AAAA'), null);
  assert.equal(parsePhoto('data:image/jpeg;base64,YWJj'), null);
  assert.equal(parseInvoice(invoice({ penerimaNama: '' })), null);
});

test('file invoice store survives a new store instance', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'invoice-store-'));
  const filePath = path.join(directory, 'invoices.json');
  try {
    const firstStore = createInvoiceStore({ filePath });
    const created = firstStore.create(invoice());
    const secondStore = createInvoiceStore({ filePath });
    assert.equal(secondStore.get(created.id).invoice.idTransaksi, '260822AI8GSS5F');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

'use strict';

/**
 * S16-1 — yanıt sıkıştırma yapılandırması testleri.
 * (a) saf filtre: SSE + x-no-compression hariç tutulur.
 * (b) entegrasyon: minimal express app'te büyük JSON gzip'lenir, küçük yanıt ve
 *     SSE gzip'lenmez. app.js'i ayağa kaldırmadan, izole olarak doğrular.
 */

const express = require('express');
const request = require('supertest');
const compression = require('compression');
const {
  compressionFilter,
  compressionOptions,
  COMPRESSION_THRESHOLD,
} = require('../../../src/middleware/compressionConfig');

describe('compressionFilter (saf)', () => {
  const reqWith = (headers = {}) => ({ headers });
  const resWithCT = (ct) => ({ getHeader: () => ct });

  it('SSE (text/event-stream) → sıkıştırma yok', () => {
    expect(compressionFilter(reqWith(), resWithCT('text/event-stream'))).toBe(false);
  });

  it('x-no-compression header → sıkıştırma yok', () => {
    expect(compressionFilter(reqWith({ 'x-no-compression': '1' }), resWithCT('application/json'))).toBe(false);
  });

  it('normal JSON → compression.filter sonucuna devreder (true)', () => {
    expect(compressionFilter(reqWith(), resWithCT('application/json'))).toBe(true);
  });
});

describe('compression entegrasyonu (izole app)', () => {
  const bigJson = { items: Array.from({ length: 200 }, (_, i) => ({ i, name: `restoran-${i}`, blurb: 'lorem ipsus dolor sit amet '.repeat(3) })) };

  function makeApp() {
    const app = express();
    app.use(compression(compressionOptions));
    app.get('/big', (_req, res) => res.json(bigJson));            // > threshold
    app.get('/small', (_req, res) => res.json({ ok: true }));      // < threshold
    app.get('/sse', (_req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.flushHeaders();
      res.write('data: ' + 'x'.repeat(COMPRESSION_THRESHOLD + 500) + '\n\n');
      res.end();
    });
    return app;
  }

  it('büyük JSON + Accept-Encoding gzip → Content-Encoding: gzip', async () => {
    const res = await request(makeApp()).get('/big').set('Accept-Encoding', 'gzip');
    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.body.items).toHaveLength(200); // supertest şeffaf açar
  });

  it('küçük yanıt → sıkıştırılmaz (eşik altı)', async () => {
    const res = await request(makeApp()).get('/small').set('Accept-Encoding', 'gzip');
    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('SSE → gzip yok (akış muaf)', async () => {
    const res = await request(makeApp()).get('/sse').set('Accept-Encoding', 'gzip');
    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('Accept-Encoding yok → sıkıştırılmaz', async () => {
    const res = await request(makeApp()).get('/big').set('Accept-Encoding', 'identity');
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.body.items).toHaveLength(200);
  });
});

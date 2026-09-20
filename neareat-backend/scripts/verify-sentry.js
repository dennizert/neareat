#!/usr/bin/env node
'use strict';

/**
 * Sentry canlı doğrulaması — çalıştır: `node scripts/verify-sentry.js`
 *
 * NEDEN VAR: `tests/unit/services/sentry.test.js` `@sentry/node`'u MOCK'luyor ve paket
 * DSN'siz koştuğu için üretim yolu tamamen no-op. Testlerin yeşil olması SDK'nın
 * gerçekten çalıştığını KANITLAMAZ. Sentry bozulduğunda hata vermez — gözlemlenebilirliği
 * sessizce kaybedersin ve bunu ancak ihtiyacın olduğu gün fark edersin.
 *
 * Bu betik SENTRY_DSN'i yerel bir HTTP sunucusuna yönlendirir, GERÇEK SDK'yı çalıştırır,
 * ağa çıkan zarfı yakalar ve JSON'unu ayrıştırır.
 *
 * `@sentry/node` her yükseltmesinde ÖNCESİ ve SONRASI koşulmalı; iki çıktı aynıysa
 * davranış korunmuştur. Beklenen: `SONUC: GECTI`
 *
 * DİKKAT — ham gövdede metin aramak YANILTICIDIR: Sentry exception ile birlikte kaynak
 * kodu bağlamı (stack frame çevresindeki satırlar) gönderir; bu dosyada sır literali
 * yazsaydık "sızıntı" gibi görünürdü. Bu yüzden sırlar runtime'da üretilir ve kontrol
 * ham metinde değil ayrıştırılmış `extra` alanında yapılır.
 */

const http = require('http');
const path = require('path');

const PORT = Number(process.env.PROBE_PORT || 9787);
const ROOT = path.resolve(__dirname, '..');
const envelopes = [];

// Sırlar literal YAZILMAZ — kaynak bağlamına sızıp yanlış alarm üretmesin.
const SECRET_TOKEN = ['gizli', 'token', String(Date.now())].join('-');
const SECRET_PASS = ['gizli', 'sifre', String(Date.now())].join('-');

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    envelopes.push(body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
});

/** Sentry zarfı satır satır JSON'dur (header \n itemHeader \n payload …). */
function parseItems(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (o.message || o.exception || o.extra) out.push(o);
    } catch {
      /* zarf/item header satırı — atla */
    }
  }
  return out;
}

server.listen(PORT, '127.0.0.1', async () => {
  process.env.SENTRY_DSN = `http://probekey@127.0.0.1:${PORT}/1`;
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';

  const { captureSecurityEvent, captureException, getSentry } = require(
    path.join(ROOT, 'src/services/sentry'),
  );

  captureSecurityEvent('AUTH_FAILED', { ip: '1.2.3.4', token: SECRET_TOKEN, reason: 'invalid' });
  captureException(new Error('probe-5xx-hatasi'), { requestId: 'r-1', password: SECRET_PASS });

  const s = getSentry();
  if (s && s.flush) await s.flush(4000);
  await new Promise((r) => setTimeout(r, 1200));

  const items = envelopes.flatMap(parseItems);
  const msg = items.find((i) => typeof i.message === 'string' && i.message.includes('AUTH_FAILED'));
  const exc = items.find((i) => i.exception);
  const extras = items.map((i) => i.extra || {});

  const tokenRedacted = extras.some((e) => e.token === '[redacted]');
  const passRedacted = extras.some((e) => e.password === '[redacted]');
  const tokenLeaked = extras.some((e) => e.token === SECRET_TOKEN);
  const passLeaked = extras.some((e) => e.password === SECRET_PASS);
  const anywhere = envelopes.join('\n');
  const rawLeak = anywhere.includes(SECRET_TOKEN) || anywhere.includes(SECRET_PASS);

  const version = require(path.join(ROOT, 'node_modules/@sentry/node/package.json')).version;
  console.log('SDK sürümü           :', version);
  console.log('zarf sayısı          :', envelopes.length);
  console.log('güvenlik mesajı      :', !!msg, msg ? `(${msg.level})` : '');
  console.log('exception            :', !!exc);
  console.log('extra.token maskeli  :', tokenRedacted, '| sızdı:', tokenLeaked);
  console.log('extra.password mask. :', passRedacted, '| sızdı:', passLeaked);
  console.log('gövdenin herhangi bir yerinde ham sır:', rawLeak);

  const ok = !!msg && !!exc && tokenRedacted && passRedacted && !tokenLeaked && !passLeaked && !rawLeak;
  console.log('SONUC:', ok ? 'GECTI' : 'KALDI');

  server.close();
  process.exit(ok ? 0 : 1);
});

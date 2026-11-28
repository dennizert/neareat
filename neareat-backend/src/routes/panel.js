'use strict';

/**
 * /panel — web panelinin (Vite SPA, `web/dist`) aynı origin'den servis edilmesi
 * (ADR-001 #3, §2; issue #526).
 *
 *  - `/panel/assets/*`  → dosya; adları içerik özetli olduğu için 1 yıl `immutable`.
 *                         Olmayan varlık 404 — index.html'e DÜŞMEZ (yoksa tarayıcı HTML'i
 *                         betik diye yükler, hata ayıklaması zor bir beyaz ekran çıkar).
 *  - Diğer `/panel/*`   → kökteki statik dosya varsa o (favicon vb., kısa önbellek),
 *                         yoksa `index.html` (SPA yönlendirmesi), `Cache-Control: no-cache`
 *                         → yeni deploy'da eski betik adlarına bağlı kalınmaz.
 *  - `web/dist` yoksa   → backend YİNE açılır; `/panel` 503 + açıklama döner. Dosya varlığı
 *                         istek anında denetlenir, açılışta değil: derleme olmadan çalışan
 *                         geliştirme/test ortamı ve mobil API etkilenmez.
 *  - CSP yalnızca bu router'ın yanıtlarına uygulanır; app geneli helmet'te CSP kapalı kalır
 *    (API JSON döner). `/verify-email`, `/reset-password` vb. dokunulmadı.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');

const DEFAULT_DIST_DIR = path.join(__dirname, '..', '..', 'web', 'dist');
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

// Google Identity Services (GIS) — resmi CSP listesi: betik, stil, iframe ve bağlantı.
const GIS = 'https://accounts.google.com/gsi/';

/** Foto deposunun (S3) origin'i — yapılandırılmamışsa null. */
function photoStoreOrigin(env = process.env) {
  if (!env.AWS_S3_BUCKET || !env.AWS_REGION) return null;
  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;
}

/**
 * Panel CSP yönergeleri (saf — test edilir).
 * Betik/stil: kendi origin + GIS + Google Fonts. Bağlantı: kendi origin + Google + foto deposu.
 * `frame-ancestors 'none'`: panel başka bir sitenin çerçevesine alınamaz (clickjacking).
 */
function buildPanelCspDirectives(env = process.env) {
  const store = photoStoreOrigin(env);
  const withStore = (list) => (store ? [...list, store] : list);
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", `${GIS}client`],
    styleSrc: ["'self'", `${GIS}style`, 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: withStore([
      "'self'", 'data:', 'blob:',
      'https://maps.googleapis.com', 'https://*.googleusercontent.com', 'https://*.gstatic.com',
    ]),
    connectSrc: withStore(["'self'", GIS]),
    frameSrc: [GIS],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  };
}

function resolveDistDir(env = process.env) {
  return env.WEB_DIST_DIR ? path.resolve(env.WEB_DIST_DIR) : DEFAULT_DIST_DIR;
}

function sendPanelUnavailable(res) {
  res.status(503)
    .set('Cache-Control', 'no-store')
    .type('text/plain; charset=utf-8')
    .send('Web paneli bu sunucuda henüz derlenmedi (web/dist bulunamadı).');
}

/**
 * @param {{ distDir?: string }} [opts]
 * @returns {import('express').Router}
 */
function createPanelRouter({ distDir = resolveDistDir() } = {}) {
  const router = express.Router();
  const indexFile = path.join(distDir, 'index.html');
  const assetsDir = path.join(distDir, 'assets');

  router.use(helmet.contentSecurityPolicy({ useDefaults: false, directives: buildPanelCspDirectives() }));
  // GIS açılır pencere akışı opener ilişkisine ihtiyaç duyar; app geneli `same-origin`
  // pencereyi koparır. Yalnızca panel sayfalarında gevşetilir.
  router.use((_req, res, next) => {
    res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  });

  router.use('/assets', express.static(assetsDir, {
    index: false,
    fallthrough: true,
    immutable: true,
    maxAge: ONE_YEAR_SECONDS * 1000,
  }));
  router.use('/assets', (_req, res) => {
    res.status(404).set('Cache-Control', 'no-store').type('text/plain; charset=utf-8').send('Bulunamadı');
  });

  router.use(express.static(distDir, {
    index: false,
    redirect: false, // `/panel` → `/panel/` dizin yönlendirmesi yok; SPA fallback karşılar
    fallthrough: true,
    maxAge: 60 * 60 * 1000, // kök dosyalar (favicon, robots) adı özetsiz → kısa önbellek
    setHeaders: (res, filePath) => {
      if (path.basename(filePath) === 'index.html') res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  router.get('/{*splat}', (req, res, next) => {
    if (!fs.existsSync(indexFile)) return sendPanelUnavailable(res);
    res.set('Cache-Control', 'no-cache');
    // `root` ile: mutlak yol verilirse `send` yolun TAMAMINDA nokta-dizin arar ve
    // (ör. `.../.cache/...` altında kurulu) dizinlerde sessizce 404 döner.
    res.sendFile('index.html', { root: distDir }, (err) => {
      if (err && !res.headersSent) next(err);
    });
  });

  return router;
}

module.exports = { createPanelRouter, buildPanelCspDirectives, photoStoreOrigin, resolveDistDir, DEFAULT_DIST_DIR };

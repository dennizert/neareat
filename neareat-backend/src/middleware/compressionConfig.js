'use strict';

/**
 * Yanıt sıkıştırma (gzip) yapılandırması — S16-1.
 *
 * Neden: liste/JSON uçları (Keşfet, sosyal feed, bildirim, mesaj) sıkıştırılmadan
 * gönderiliyordu; gzip ile gövde tipik %60–80 küçülür → mobilde (yavaş ağ) hız +
 * çıkış bant genişliği/maliyet düşer. 10k kullanıcıda en sık çağrılan uçlar bunlar.
 *
 * SSE muafiyeti: `/api/recommendations/*` akışları `text/event-stream` döner; gzip
 * buffering keepalive ping'lerini geciktirip Railway proxy timeout'una yol açabilir.
 * Bu yüzden streaming yanıtlar sıkıştırılmaz. İstemci `x-no-compression` ile de
 * açıkça opt-out edebilir.
 *
 * Saf filtre fonksiyonu ayrı export edilir → app.js'i ayağa kaldırmadan birim test.
 */

const compression = require('compression');

// 1KB altı yanıtları sıkıştırma — küçük gövdede gzip CPU'su faydadan büyük.
const COMPRESSION_THRESHOLD = 1024;

/**
 * compression `filter` — hangi yanıtın sıkıştırılacağına karar verir.
 * SSE (text/event-stream) ve `x-no-compression` istekleri hariç tutulur;
 * gerisi compression'ın varsayılan `compressible` mantığına devredilir.
 */
function compressionFilter(req, res) {
  const contentType = res.getHeader('Content-Type');
  if (contentType && String(contentType).includes('text/event-stream')) return false;
  if (req.headers['x-no-compression']) return false;
  return compression.filter(req, res);
}

const compressionOptions = {
  threshold: COMPRESSION_THRESHOLD,
  filter: compressionFilter,
};

module.exports = { compressionFilter, compressionOptions, COMPRESSION_THRESHOLD };

'use strict';

/**
 * İstek metrik middleware'i — S16-2.
 *
 * Her isteğin süresini (yüksek çözünürlüklü) ve HTTP status'unu `res 'finish'`
 * olayında kaydeder. Düşük ek yük: yalnızca bir timer + sayaç++. requestId'den
 * hemen sonra, tüm pipeline'ı (rate-limit/auth/controller) kapsayacak şekilde
 * en başta devreye alınır.
 */

const { recordRequest } = require('../services/metrics');

module.exports = function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    recordRequest(durationMs, res.statusCode);
  });
  next();
};

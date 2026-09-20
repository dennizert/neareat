'use strict';

// Hafif ürün analitiği — mobil sink'in yazdığı funnel event'lerini saklar ve
// admin panelinin okuyacağı özet sorguyu üretir.
//
// Neden bu servis: mobil `services/analytics.ts` "sağlayıcı-agnostik" olarak
// tasarlanmıştı ama `setAnalyticsSink` hiç çağrılmıyordu — 5 funnel event'i
// (paywall görüntüleme, restoran detayı açma, rezervasyon başlatma/tamamlama, AI
// öneri talebi) kodda üretiliyor ve hiçbir yere gitmiyordu. Bu servis o boşluğu
// kapatır: kendi Postgres'imize yazar (üçüncü taraf yok, KVKK'da yurt dışı
// aktarım yok, admin panelinde zaten çalışan Prisma sorgularıyla okunur).

const prisma = require('../utils/prisma');
const { HttpError } = require('../utils/httpError');

const MAX_NAME_LENGTH = 100;
const MAX_PROPS_KEYS = 20;
const MAX_PROP_STRING_LENGTH = 500;

// Mobil taraf zaten `stripPii` uyguluyor (services/analytics.ts) ama backend'e
// güvenmemek gerekir: client bir bug ile filtreyi atlayabilir, ya da ileride
// PII stripleme çağrısı unutularak yeni bir çağrı yeri eklenebilir. Aynı desen
// (anahtar adına göre eleme) burada DERİNLEMESİNE SAVUNMA olarak tekrarlanır.
const PII_KEY_RE = /(email|password|phone|token|authorization|address)/i;

/**
 * Gövdedeki `props` nesnesini güvenli hâle getirir: PII anahtarlarını atar, aşırı
 * uzun string değerleri kısaltır, iç içe nesne/dizi gibi büyük yapıları reddetmez
 * ama JSON.stringify ile serileştirilebilir olmasını Prisma zaten garanti eder.
 * Saf fonksiyon — DB'den ve istekten bağımsız, doğrudan test edilir.
 */
function sanitizeProps(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return null;
  const out = {};
  let count = 0;
  for (const [key, value] of Object.entries(props)) {
    if (count >= MAX_PROPS_KEYS) break;
    if (PII_KEY_RE.test(key)) continue;
    if (typeof value === 'string') {
      out[key] = value.slice(0, MAX_PROP_STRING_LENGTH);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      out[key] = value;
    } else {
      continue; // nesne/dizi/undefined — sessizce atla, hata fırlatma
    }
    count++;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Bir funnel event'ini kaydeder. `userId` null olabilir (anonim/misafir kullanıcı
 * — optionalAuth). Asla fırlatmaz beklenmedik durumlar dışında; çağıran controller
 * geçersiz girdide 400 döner, DB hatası errorHandler'a gider.
 */
async function recordEvent({ userId, name, props }) {
  const trimmedName = String(name || '').trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmedName) {
    throw new HttpError(400, { error: 'name zorunludur.' });
  }
  await prisma.analyticsEvent.create({
    data: { userId: userId || null, name: trimmedName, props: sanitizeProps(props) },
    select: { id: true },
  });
}

/**
 * Admin özet: son N gün için event adına göre sayım. Amaç "Keşfet → detay →
 * rezervasyon" hunisini görebilmek — tek bir groupBy ile tüm event isimlerinin
 * sayısı döner, huni oranını hesaplamak çağıran tarafın (admin ekranı) işi.
 */
async function getFunnelSummary({ days = 7 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.analyticsEvent.groupBy({
    by: ['name'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { name: 'desc' } },
  });
  return {
    sinceDays: days,
    events: rows.map((r) => ({ name: r.name, count: r._count._all })),
  };
}

module.exports = { recordEvent, getFunnelSummary, sanitizeProps, MAX_NAME_LENGTH };

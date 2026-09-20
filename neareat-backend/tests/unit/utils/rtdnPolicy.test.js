'use strict';

/**
 * NEW-B01 (issue #449) — RTDN sıra/tazelik politikası, saf çekirdek.
 *
 * Açık: `handleGooglePlayRTDN` bildirimi koşulsuz uyguluyordu. Pub/Sub en-az-bir-kez
 * teslim ettiği için aylar önceki bir EXPIRED yeniden teslim edildiğinde yenilenmiş,
 * ödenmiş bir abonelik sessizce düşüyordu (restoran paneli + rezervasyon kabulü gider).
 */

const {
  NOTIFICATION,
  parseEventTime,
  isStaleEvent,
  contradictsKnownExpiry,
  decideRtdnAction,
} = require('../../../src/utils/rtdnPolicy');

const NOW = Date.UTC(2026, 8, 20); // 2026-09-20
const FUTURE = new Date(Date.UTC(2099, 11, 31));
const PAST = new Date(Date.UTC(2026, 8, 19));

describe('parseEventTime', () => {
  it('string milisaniyeyi sayıya çevirir (Google string gönderir)', () => {
    expect(parseEventTime('1758326400000')).toBe(1758326400000);
  });

  // Fail-open: zamanı okuyamadığımız için bir YENİLEMEYİ bloklamak, müşteriyi
  // erişimsiz bırakmak olurdu. Sıralama denetimi iyileştirmedir, ön koşul değil.
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['boş string', ''],
    ['sayı değil', 'abc'],
    ['sıfır', '0'],
    ['negatif', '-5'],
    ['NaN', NaN],
  ])('%s → null (sıralama denetimi atlanır)', (_l, input) => {
    expect(parseEventTime(input)).toBeNull();
  });
});

describe('isStaleEvent', () => {
  const last = new Date(Date.UTC(2026, 8, 15));

  it('daha eski olay → stale', () => {
    expect(isStaleEvent(Date.UTC(2026, 8, 10), last)).toBe(true);
  });

  // Aynı eventTimeMillis ile gelen ikinci teslim yeni bir olay değil, tekrardır.
  it('AYNI olay zamanı → stale (tekrar teslim)', () => {
    expect(isStaleEvent(last.getTime(), last)).toBe(true);
  });

  it('daha yeni olay → stale değil', () => {
    expect(isStaleEvent(Date.UTC(2026, 8, 20), last)).toBe(false);
  });

  it('lastEventAt yoksa (ilk olay) → stale değil', () => {
    expect(isStaleEvent(Date.UTC(2026, 8, 10), null)).toBe(false);
  });

  it('olay zamanı okunamadıysa → stale değil (fail-open)', () => {
    expect(isStaleEvent(null, last)).toBe(false);
  });
});

describe('contradictsKnownExpiry', () => {
  it('EXPIRED + bitiş gelecekte → çelişki', () => {
    expect(contradictsKnownExpiry(NOTIFICATION.EXPIRED, FUTURE, NOW)).toBe(true);
  });

  it('EXPIRED + bitiş geçmişte → çelişki yok (gerçek bitiş)', () => {
    expect(contradictsKnownExpiry(NOTIFICATION.EXPIRED, PAST, NOW)).toBe(false);
  });

  // G4 — iade doğası gereği bitiş tarihinden ÖNCE gelir; gelecekteki bir expiresAt
  // orada BEKLENEN durumdur. Çelişki sayıp yok saymak gerçek iadeyi kaçırmak olur.
  it('REVOKED + bitiş gelecekte → çelişki DEĞİL (dönem ortası iade meşru)', () => {
    expect(contradictsKnownExpiry(NOTIFICATION.REVOKED, FUTURE, NOW)).toBe(false);
  });

  it.each([
    ['RENEWED', NOTIFICATION.RENEWED],
    ['CANCELED', NOTIFICATION.CANCELED],
    ['PURCHASED', NOTIFICATION.PURCHASED],
  ])('%s → çelişki denetimi uygulanmaz', (_l, type) => {
    expect(contradictsKnownExpiry(type, FUTURE, NOW)).toBe(false);
  });

  it('expiresAt yoksa çelişki yok', () => {
    expect(contradictsKnownExpiry(NOTIFICATION.EXPIRED, null, NOW)).toBe(false);
  });
});

describe('decideRtdnAction', () => {
  const base = { eventTimeMs: Date.UTC(2026, 8, 20), lastEventAt: null, expiresAt: PAST, now: NOW };

  it('T1 eski olay → skip', () => {
    expect(decideRtdnAction({
      ...base, notificationType: NOTIFICATION.RENEWED,
      eventTimeMs: Date.UTC(2026, 8, 1), lastEventAt: new Date(Date.UTC(2026, 8, 15)),
    })).toEqual({ action: 'skip', reason: 'stale_or_duplicate' });
  });

  it('T2 aynı olay zamanı (tekrar teslim) → skip', () => {
    const t = Date.UTC(2026, 8, 15);
    expect(decideRtdnAction({
      ...base, notificationType: NOTIFICATION.RENEWED, eventTimeMs: t, lastEventAt: new Date(t),
    }).action).toBe('skip');
  });

  it('T3 yeni olay → apply', () => {
    expect(decideRtdnAction({
      ...base, notificationType: NOTIFICATION.RENEWED, lastEventAt: new Date(Date.UTC(2026, 8, 1)),
    })).toEqual({ action: 'apply', reason: 'ok' });
  });

  it('T4 ilk olay (lastEventAt yok) → apply', () => {
    expect(decideRtdnAction({ ...base, notificationType: NOTIFICATION.RENEWED }).action).toBe('apply');
  });

  it('T5 olay zamanı eksik → sıralama atlanır, işleme devam', () => {
    expect(decideRtdnAction({
      ...base, notificationType: NOTIFICATION.RENEWED,
      eventTimeMs: null, lastEventAt: new Date(Date.UTC(2099, 0, 1)),
    }).action).toBe('apply');
  });

  // ASIL HATA (S1): yıl 2000 EXPIRED + 2099 bitiş.
  it('T6 EXPIRED + bitiş gelecekte → verify (abonelik DÜŞÜRÜLMEZ)', () => {
    expect(decideRtdnAction({
      ...base, notificationType: NOTIFICATION.EXPIRED, expiresAt: FUTURE,
    })).toEqual({ action: 'verify', reason: 'expired_contradicts_future_expiry' });
  });

  it('T7 EXPIRED + bitiş geçmişte → apply (gerçek bitiş, erişim kapanır)', () => {
    expect(decideRtdnAction({
      ...base, notificationType: NOTIFICATION.EXPIRED, expiresAt: PAST,
    }).action).toBe('apply');
  });

  it('T8 REVOKED + bitiş gelecekte → apply (dönem ortası iade)', () => {
    expect(decideRtdnAction({
      ...base, notificationType: NOTIFICATION.REVOKED, expiresAt: FUTURE,
    }).action).toBe('apply');
  });

  // Sıra önemli: bayat bir EXPIRED için Play'e sormak gereksiz kota harcamasıdır.
  it('T9 sıralama denetimi çelişki denetiminden ÖNCE çalışır', () => {
    expect(decideRtdnAction({
      ...base,
      notificationType: NOTIFICATION.EXPIRED,
      expiresAt: FUTURE,
      eventTimeMs: Date.UTC(2000, 0, 1),
      lastEventAt: new Date(Date.UTC(2026, 8, 15)),
    })).toEqual({ action: 'skip', reason: 'stale_or_duplicate' });
  });
});

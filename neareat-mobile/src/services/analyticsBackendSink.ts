/**
 * Kendi backend'imize yazan analytics sink'i (#481).
 *
 * `services/analytics.ts` sağlayıcı-agnostik tasarlandı (`setAnalyticsSink`), ama
 * hiçbir sink hiç takılmıyordu — 5 funnel event'i (`ANALYTICS_EVENTS`) üretiliyor ve
 * boşluğa akıyordu. Bu dosya o sink'in KENDİ BACKEND'imize yazan implementasyonu.
 *
 * Ayrı dosyada tutuluyor ki `services/analytics.ts` sağlayıcıdan bağımsız kalsın —
 * ileride PostHog/Amplitude'a geçilirse yalnızca bu dosya değişir/silinir.
 *
 * NEDEN ANA `api` INSTANCE'I KULLANILIYOR: backend ucu (`POST /analytics/events`)
 * `optionalAuth` kullanıyor, yani token yoksa/süresi dolmuşsa 401 DÖNMEZ (anonim
 * sayar). Bu yüzden `services/api.ts`'in 401→logout interceptor'ı burada tetiklenme
 * riski taşımıyor — analitik hiçbir zaman kullanıcıyı yanlışlıkla çıkış yaptırmaz.
 */
import api from './api';
import type { AnalyticsSink } from './analytics';

// Fire-and-forget: analitik asla ana akışı bloklamamalı veya bozmamalı. Hata
// (ağ, sunucu 5xx, vb.) sessizce yutulur — trackEvent zaten kendi try/catch'inde
// senkron hataları yakalıyor ama bu sink ASENKRON, promise reddi ayrıca yutulmalı.
export const backendAnalyticsSink: AnalyticsSink = (name, props) => {
  api.post('/analytics/events', { name, props }).catch(() => {
    /* analitik asla akışı bozmamalı */
  });
};

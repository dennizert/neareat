/**
 * Keşfet listesi stale-while-revalidate yardımcıları (S15-P2).
 *
 * Neden: Uygulama her açıldığında liste sıfırdan boş gelip skeleton gösteriyor ve
 * tam ağ turu bekleniyordu. Önceki listeyi persist edip ANINDA gösterip arka planda
 * tazeleyince (stale-while-revalidate) algılanan açılış süresi sıfıra yaklaşır.
 *
 * Bu modül yalnızca saf karar fonksiyonları içerir (native modül importu yok) — böylece
 * birim testleri ağır ekran mount'u olmadan koşar (mobil test konvansiyonu).
 */

/** Persist'ten gelen listenin anında gösterilebilir olup olmadığını söyler. */
export function isCachedListUsable(restaurants: unknown): boolean {
  return Array.isArray(restaurants) && restaurants.length > 0;
}

/**
 * Skeleton gösterilmeli mi?
 *
 * Yalnızca: persist hidrasyonu bitti VE elimizde gösterilecek kayıt yok VE yükleniyor.
 * Hidrasyon bitmeden skeleton göstermeyiz — aksi halde cache'li kullanıcıda kısa bir
 * skeleton yanıp sönmesi olur; bunun yerine hidrasyon bitince kartlar doğrudan gelir.
 */
export function shouldShowSkeleton(opts: {
  hasHydrated: boolean;
  loading: boolean;
  itemCount: number;
}): boolean {
  return opts.hasHydrated && opts.loading && opts.itemCount === 0;
}

/** Liste "bayat" sayılma eşiği (ms) — focus/arka plan tazeleme kararıyla uyumlu. */
export const LIST_STALE_MS = 30_000;

/**
 * Önbellekteki liste tazelenmeli mi (yaşı eşikten büyük mü)?
 * lastFetchedAt yoksa daima true (hiç çekilmemiş → tazele).
 */
export function isListStale(
  lastFetchedAt: number | null | undefined,
  now: number,
  maxAgeMs: number = LIST_STALE_MS,
): boolean {
  if (!lastFetchedAt) return true;
  return now - lastFetchedAt > maxAgeMs;
}

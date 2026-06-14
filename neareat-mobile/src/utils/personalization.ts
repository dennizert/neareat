/**
 * Kişiselleştirilmiş Keşfet saf karar yardımcıları (Sprint-17 #366).
 *
 * HomeScreen'in kişiselleştirme görünümünü ne zaman gösterip ne zaman standart
 * nearby deneyimine düşeceğini belirleyen, React'tan bağımsız (test edilebilir) mantık.
 */
import type { PersonalizedDiscovery, Restaurant } from '../types';

interface DiscoveryContext {
  isSearching: boolean;
  selectedCuisineTag: string | null;
  personalized: PersonalizedDiscovery | null;
}

/**
 * Kişiselleştirilmiş sıralama devrede mi? Yalnızca varsayılan görünümde
 * (arama yok + mutfak filtresi yok) ve sunucu "forYou" döndürdüyse aktif.
 */
export function isPersonalizationActive({ isSearching, selectedCuisineTag, personalized }: DiscoveryContext): boolean {
  return !isSearching && selectedCuisineTag === null && !!personalized && personalized.forYou.length > 0;
}

/**
 * "Son Baktıkların" / "Tekrar gitmek ister misin?" rayları gösterilsin mi?
 */
export function shouldShowRails(ctx: DiscoveryContext & { viewMode: string }): boolean {
  const { viewMode, isSearching, selectedCuisineTag, personalized } = ctx;
  return (
    viewMode === 'list' && !isSearching && selectedCuisineTag === null && !!personalized &&
    (personalized.recentlyViewed.length > 0 || personalized.revisit.length > 0)
  );
}

/**
 * Kişisel skorlu forYou listesini, kalan nearby öğelerin önüne koyar (mükerrer
 * olmadan). Böylece liste hem kişiselleşir hem de hiçbir mekan kaybolmaz.
 */
export function mergeForYou(forYou: Restaurant[], nearby: Restaurant[]): Restaurant[] {
  const ids = new Set(forYou.map((r) => r.placeId));
  return [...forYou, ...nearby.filter((r) => !ids.has(r.placeId))];
}

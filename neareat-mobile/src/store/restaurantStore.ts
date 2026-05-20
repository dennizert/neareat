/**
 * Restoran Listesi Store'u (Zustand)
 *
 * Ana ekrandaki restoran listesinin state'ini yönetir:
 * - Yakındaki restoranların listesi
 * - Sıralama seçeneği (mesafe, puan, yorum sayısı)
 * - Filtreleme (mutfak türü, açık olanlar, fiyat seviyesi)
 * - Görünüm modu (liste/harita)
 * - Seçili kategori
 *
 * getSortedFiltered() fonksiyonu ile client-side filtreleme ve sıralama yapılır —
 * her filtre değişikliğinde backend'e istek atılmaz, anlık güncellenir.
 */
import { create } from 'zustand';
import type { Restaurant, SortOption, FilterState } from '../types';

interface RestaurantState {
  restaurants: Restaurant[];
  loading: boolean;
  error: string | null;
  sortBy: SortOption;
  filters: FilterState;
  viewMode: 'list' | 'map';
  selectedCategory: string;

  setRestaurants: (restaurants: Restaurant[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSortBy: (sort: SortOption) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setViewMode: (mode: 'list' | 'map') => void;
  setSelectedCategory: (cat: string) => void;
  getSortedFiltered: () => Restaurant[];
}

/** Varsayılan filtre değerleri — hiçbir filtre uygulanmamış durumu temsil eder */
const defaultFilters: FilterState = {
  cuisineTypes: [],
  openNow: false,
  priceLevels: [],
};

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  restaurants: [],
  loading: false,
  error: null,
  sortBy: 'distance',
  filters: defaultFilters,
  viewMode: 'list',
  selectedCategory: 'all',

  /** Backend'den gelen restoran listesini store'a yazar */
  setRestaurants:      (restaurants)    => set({ restaurants }),
  /** Yükleniyor durumunu günceller (loading spinner kontrolü) */
  setLoading:          (loading)        => set({ loading }),
  /** Hata mesajını günceller */
  setError:            (error)          => set({ error }),
  /** Sıralama seçeneğini değiştirir */
  setSortBy:           (sortBy)         => set({ sortBy }),
  /** Filtreleri kısmen günceller (partial merge) — sadece değişen alan gönderilir */
  setFilters:          (filters)        => set((s) => ({ filters: { ...s.filters, ...filters } })),
  /** Liste/harita görünüm modunu değiştirir */
  setViewMode:         (viewMode)       => set({ viewMode }),
  /** Kategori tab'ını değiştirir */
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  /**
   * Mevcut restoran listesini filtreler ve sıralar.
   * Client-side çalışır — backend'e ek istek atmaz.
   *
   * Neden bu fonksiyon yazıldı:
   * Kullanıcı filtre veya sıralama değiştirdiğinde anlık güncelleme sağlar.
   * Backend'e her filtre değişikliğinde istek atmak UX'i yavaşlatır ve
   * gereksiz API kullanımı yaratır. Restoran listesi zaten bellekte olduğundan
   * client-side filtreleme çok daha hızlıdır.
   *
   * Filtreleme sırası:
   * 1. Kategori filtresi (ör. "cafe", "restaurant")
   * 2. "Şu an açık" filtresi
   * 3. Seçilen kritere göre sıralama (mesafe, puan, yorum sayısı)
   */
  getSortedFiltered: () => {
    const { restaurants, sortBy, filters, selectedCategory } = get();
    let list = [...restaurants];

    // Kategori filtresi — client-side, anlık (API çağrısı yok)
    if (selectedCategory !== 'all') {
      list = list.filter((r) => r.types?.includes(selectedCategory));
    }

    // Sadece açık restoranları göster
    if (filters.openNow) {
      list = list.filter((r) => r.isOpenNow === true);
    }

    // Seçilen kritere göre sırala
    list.sort((a, b) => {
      if (sortBy === 'distance')         return a.distanceKm - b.distanceKm;
      if (sortBy === 'rating')           return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === 'userRatingsTotal') return (b.userRatingsTotal ?? 0) - (a.userRatingsTotal ?? 0);
      return 0;
    });

    return list;
  },
}));

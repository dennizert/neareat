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
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Restaurant, SortOption, FilterState } from '../types';
import { searchPlaces } from '../services/restaurants';

interface RestaurantState {
  restaurants: Restaurant[];
  loading: boolean;
  error: string | null;
  sortBy: SortOption;
  filters: FilterState;
  viewMode: 'list' | 'map';
  selectedCategory: string;

  // Sprint-6 #83 — serbest metin araması
  searchQuery: string;
  searchResults: Restaurant[];
  searchLoading: boolean;
  searchError: string | null;

  setRestaurants: (restaurants: Restaurant[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSortBy: (sort: SortOption) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setViewMode: (mode: 'list' | 'map') => void;
  setSelectedCategory: (cat: string) => void;
  getSortedFiltered: () => Restaurant[];

  setSearchQuery: (q: string) => void;
  performSearch: (q: string, lat?: number, lng?: number) => Promise<void>;
  clearSearch: () => void;
}

/** Varsayılan filtre değerleri — hiçbir filtre uygulanmamış durumu temsil eder */
const defaultFilters: FilterState = {
  cuisineTypes: [],
  openNow: false,
  priceLevels: [],
};

export const useRestaurantStore = create<RestaurantState>()(persist((set, get) => ({
  restaurants: [],
  loading: false,
  error: null,
  sortBy: 'distance',
  filters: defaultFilters,
  viewMode: 'list',
  selectedCategory: 'all',

  searchQuery: '',
  searchResults: [],
  searchLoading: false,
  searchError: null,

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

  /** Arama metni state'i — debounce + UI değişimi için tek source */
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  /**
   * Backend'den arama sonuçlarını çeker. Boş sorgu → hızlı temizleme.
   * lat/lng verilirse konum bias uygulanır (backend tarafında).
   */
  performSearch: async (q, lat, lng) => {
    const query = q.trim();
    if (query.length < 2) {
      set({ searchResults: [], searchLoading: false, searchError: null });
      return;
    }
    set({ searchLoading: true, searchError: null });
    try {
      const { results } = await searchPlaces(query, lat, lng);
      set({ searchResults: results, searchLoading: false });
    } catch (err: any) {
      set({ searchResults: [], searchLoading: false, searchError: err?.message || 'Arama başarısız' });
    }
  },

  clearSearch: () => set({ searchQuery: '', searchResults: [], searchLoading: false, searchError: null }),
}), {
  name: 'neareat-restaurant-filters',
  storage: createJSONStorage(() => AsyncStorage),
  // Yalnızca kullanıcı tercihlerini kalıcı tut — runtime state (restaurants,
  // searchResults, loading vb.) restart sonrası yeniden yüklenmeli.
  partialize: (state) => ({
    filters: state.filters,
    sortBy: state.sortBy,
    selectedCategory: state.selectedCategory,
    viewMode: state.viewMode,
  }),
}));

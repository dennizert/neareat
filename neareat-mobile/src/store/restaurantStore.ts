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
import {
  getSearchHistory as fetchSearchHistory,
  clearSearchHistory as clearSearchHistoryApi,
  deleteSearchHistoryItem as deleteSearchHistoryItemApi,
  type SearchHistoryItem,
} from '../services/searchHistory';

/** Konum çifti — son başarılı çekimin koordinatı (hidrasyonda yeniden kullanılır) */
interface Coords { lat: number; lng: number; }

interface RestaurantState {
  restaurants: Restaurant[];
  loading: boolean;
  error: string | null;
  sortBy: SortOption;
  filters: FilterState;
  viewMode: 'list' | 'map';
  selectedCategory: string;
  selectedCuisineTag: string | null;

  // S15-P2 — stale-while-revalidate için son çekim metası (persist edilir)
  lastCoords: Coords | null;
  lastFetchedAt: number | null;
  /** AsyncStorage hidrasyonu tamamlandı mı (skeleton kararı için) */
  _hasHydrated: boolean;

  // Sprint-6 #83 — serbest metin araması
  searchQuery: string;
  searchResults: Restaurant[];
  searchLoading: boolean;
  searchError: string | null;

  // Sprint-6 #88 — son aramalar
  searchHistory: SearchHistoryItem[];
  searchHistoryLoading: boolean;

  setRestaurants: (restaurants: Restaurant[]) => void;
  /** S15-P2 — başarılı nearby çekimini ve koordinatını damgalar (persist edilir) */
  recordNearbyFetch: (coords: Coords) => void;
  /** S15-P2 — persist hidrasyonu bittiğinde true'ya çekilir */
  setHasHydrated: (v: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSortBy: (sort: SortOption) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setViewMode: (mode: 'list' | 'map') => void;
  setSelectedCategory: (cat: string) => void;
  setSelectedCuisineTag: (tag: string | null) => void;
  getSortedFiltered: () => Restaurant[];

  setSearchQuery: (q: string) => void;
  performSearch: (q: string, lat?: number, lng?: number) => Promise<void>;
  clearSearch: () => void;

  loadSearchHistory: () => Promise<void>;
  clearSearchHistory: () => Promise<number>;
  deleteSearchHistoryItem: (id: string) => Promise<void>;
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
  selectedCuisineTag: null,

  lastCoords: null,
  lastFetchedAt: null,
  _hasHydrated: false,

  searchQuery: '',
  searchResults: [],
  searchLoading: false,
  searchError: null,

  searchHistory: [],
  searchHistoryLoading: false,

  /** Backend'den gelen restoran listesini store'a yazar */
  setRestaurants:      (restaurants)    => set({ restaurants }),
  /** Başarılı nearby çekiminden sonra koordinat + zaman damgasını kaydeder (S15-P2) */
  recordNearbyFetch:   (coords)         => set({ lastCoords: coords, lastFetchedAt: Date.now() }),
  /** Persist hidrasyonu tamamlandığını işaretler (S15-P2) */
  setHasHydrated:      (v)              => set({ _hasHydrated: v }),
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
  /** Cuisine chip filtresini değiştirir (aynı tag tekrar seçilince temizler) */
  setSelectedCuisineTag: (selectedCuisineTag) => set({ selectedCuisineTag }),

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
    const { restaurants, sortBy, filters, selectedCategory, selectedCuisineTag } = get();
    let list = [...restaurants];

    // Kategori filtresi — client-side, anlık (API çağrısı yok)
    if (selectedCategory !== 'all') {
      list = list.filter((r) => r.types?.includes(selectedCategory));
    }

    // Cuisine tag chip filtresi (S7-10)
    if (selectedCuisineTag) {
      list = list.filter((r) => r.cuisineTags?.includes(selectedCuisineTag));
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

  loadSearchHistory: async () => {
    if (get().searchHistoryLoading) return;
    set({ searchHistoryLoading: true });
    try {
      const items = await fetchSearchHistory();
      set({ searchHistory: items, searchHistoryLoading: false });
    } catch {
      set({ searchHistoryLoading: false });
    }
  },

  clearSearchHistory: async () => {
    const deleted = await clearSearchHistoryApi();
    set({ searchHistory: [] });
    return deleted;
  },

  deleteSearchHistoryItem: async (id) => {
    // Optimistic: önce kaldır, hata olursa geri yükle
    const prev = get().searchHistory;
    set({ searchHistory: prev.filter((h) => h.id !== id) });
    try {
      await deleteSearchHistoryItemApi(id);
    } catch (err) {
      set({ searchHistory: prev });
      throw err;
    }
  },
}), {
  name: 'neareat-restaurant-filters',
  storage: createJSONStorage(() => AsyncStorage),
  // Kullanıcı tercihleri + S15-P2 ile son nearby listesi (stale-while-revalidate)
  // kalıcı tutulur. Arama runtime state'i (searchResults/searchQuery/loading) ve
  // searchHistory restart sonrası yeniden yüklenir — persist edilmez.
  partialize: (state) => ({
    filters: state.filters,
    sortBy: state.sortBy,
    selectedCategory: state.selectedCategory,
    selectedCuisineTag: state.selectedCuisineTag,
    viewMode: state.viewMode,
    // S15-P2 — tekrar açılışta anında gösterilecek son liste + çekim metası
    restaurants: state.restaurants,
    lastCoords: state.lastCoords,
    lastFetchedAt: state.lastFetchedAt,
  }),
  // Hidrasyon bitince işaretle — HomeScreen skeleton/tazeleme kararı buna bakar.
  onRehydrateStorage: () => (state) => { state?.setHasHydrated(true); },
}));

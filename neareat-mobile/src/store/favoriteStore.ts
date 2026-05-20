/**
 * Favori Store'u (Zustand)
 *
 * Kullanıcının favori restoranlarını yönetir.
 * Restoran detay ekranında kalp ikonuna basıldığında favori eklenir/çıkarılır.
 * isFavorite() ile anlık kontrol yapılır — backend beklemeden kalp ikonu güncellenir.
 */
import { create } from 'zustand';
import type { Favorite } from '../types';

interface FavoriteState {
  favorites: Favorite[];
  setFavorites: (favorites: Favorite[]) => void;
  addFavorite: (favorite: Favorite) => void;
  removeFavorite: (placeId: string) => void;
  isFavorite: (placeId: string) => boolean;
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favorites: [],

  /** Backend'den çekilen favori listesini store'a yazar */
  setFavorites: (favorites) => set({ favorites }),

  /** Yeni favoriyi listenin başına ekler (optimistic update) */
  addFavorite: (favorite) => set((s) => ({ favorites: [favorite, ...s.favorites] })),

  /**
   * Favoriyi placeId'ye göre listeden çıkarır.
   * Backend çağrısı ayrıca yapılır — bu sadece UI'ı anlık günceller.
   */
  removeFavorite: (placeId) =>
    set((s) => ({ favorites: s.favorites.filter((f) => f.placeId !== placeId) })),

  /**
   * Belirli bir restoranın favorilerde olup olmadığını kontrol eder.
   * Restoran detay ekranında kalp ikonunun dolu/boş gösterilmesini belirler.
   */
  isFavorite: (placeId) => get().favorites.some((f) => f.placeId === placeId),
}));

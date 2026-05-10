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
  setFavorites: (favorites) => set({ favorites }),
  addFavorite: (favorite) => set((s) => ({ favorites: [favorite, ...s.favorites] })),
  removeFavorite: (placeId) =>
    set((s) => ({ favorites: s.favorites.filter((f) => f.placeId !== placeId) })),
  isFavorite: (placeId) => get().favorites.some((f) => f.placeId === placeId),
}));

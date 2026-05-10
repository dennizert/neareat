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

  setRestaurants:      (restaurants)    => set({ restaurants }),
  setLoading:          (loading)        => set({ loading }),
  setError:            (error)          => set({ error }),
  setSortBy:           (sortBy)         => set({ sortBy }),
  setFilters:          (filters)        => set((s) => ({ filters: { ...s.filters, ...filters } })),
  setViewMode:         (viewMode)       => set({ viewMode }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  getSortedFiltered: () => {
    const { restaurants, sortBy, filters, selectedCategory } = get();
    let list = [...restaurants];

    // Category filter — client-side, instant (no API call)
    if (selectedCategory !== 'all') {
      list = list.filter((r) => r.types?.includes(selectedCategory));
    }

    // Open now
    if (filters.openNow) {
      list = list.filter((r) => r.isOpenNow === true);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'distance')         return a.distanceKm - b.distanceKm;
      if (sortBy === 'rating')           return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === 'userRatingsTotal') return (b.userRatingsTotal ?? 0) - (a.userRatingsTotal ?? 0);
      return 0;
    });

    return list;
  },
}));

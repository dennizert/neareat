/**
 * Sosyal Aktivite Akışı Store (Sprint-4 Task #6).
 *
 * Arkadaşların son 7 günlük aktivitelerini (GET /api/social/feed) tutar.
 * Cursor tabanlı sayfalama: loadInitial/refresh listeyi sıfırlar, loadMore ekler.
 */

import { create } from 'zustand';
import { getActivityFeed } from '../services/social';
import type { ActivityEvent } from '../types';

interface ActivityFeedState {
  events: ActivityEvent[];
  loading: boolean;       // ilk yükleme
  refreshing: boolean;    // pull-to-refresh
  loadingMore: boolean;   // sayfalama
  nextCursor: string | null;
  error: string | null;

  loadInitial: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  clear: () => void;
}

const INITIAL_STATE = {
  events: [] as ActivityEvent[],
  loading: false,
  refreshing: false,
  loadingMore: false,
  nextCursor: null as string | null,
  error: null as string | null,
};

const GENERIC_ERROR = 'Aktivite akışı yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.';

export const useActivityFeedStore = create<ActivityFeedState>((set, get) => ({
  ...INITIAL_STATE,

  async loadInitial() {
    // Zaten veri varsa tekrar full-load yapma (ekran her focus'ta çağırabilir)
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const { events, nextCursor } = await getActivityFeed();
      set({ loading: false, events, nextCursor, error: null });
    } catch {
      set({ loading: false, error: GENERIC_ERROR });
    }
  },

  async refresh() {
    set({ refreshing: true, error: null });
    try {
      const { events, nextCursor } = await getActivityFeed();
      set({ refreshing: false, events, nextCursor, error: null });
    } catch {
      set({ refreshing: false, error: GENERIC_ERROR });
    }
  },

  async loadMore() {
    const { nextCursor, loadingMore, loading, refreshing } = get();
    // Daha fazla yoksa veya başka bir yükleme sürüyorsa atla
    if (!nextCursor || loadingMore || loading || refreshing) return;
    set({ loadingMore: true });
    try {
      const { events, nextCursor: cursor } = await getActivityFeed(nextCursor);
      set((s) => ({
        loadingMore: false,
        events: [...s.events, ...events],
        nextCursor: cursor,
      }));
    } catch {
      // Sayfalama hatasında listeyi bozmadan sadece göstergeyi kapat
      set({ loadingMore: false });
    }
  },

  clear() {
    set({ ...INITIAL_STATE });
  },
}));

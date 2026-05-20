/**
 * Öneri Store'u (Zustand)
 *
 * Kullanıcının gönderdiği ve aldığı restoran önerilerini yönetir.
 * Sosyal özelliğin çekirdeğidir — kullanıcılar arkadaşlarına restoran önerebilir.
 * Öneri gönderme yıldız kazandırır (gamification).
 */
import { create } from 'zustand';
import type { Recommendation } from '../types';

interface RecommendationState {
  myRecommendations: Recommendation[];
  receivedRecommendations: Recommendation[];
  setMyRecommendations: (recs: Recommendation[]) => void;
  addMyRecommendation: (rec: Recommendation) => void;
  setReceivedRecommendations: (recs: Recommendation[]) => void;
  clear: () => void;
}

export const useRecommendationStore = create<RecommendationState>((set, get) => ({
  myRecommendations: [],
  receivedRecommendations: [],

  /** Backend'den çekilen gönderilmiş önerileri store'a yazar */
  setMyRecommendations: (recs) => set({ myRecommendations: recs }),

  /** Yeni gönderilen öneriyi listenin başına ekler (optimistic update) */
  addMyRecommendation: (rec) =>
    set({ myRecommendations: [rec, ...get().myRecommendations] }),

  /** Backend'den çekilen alınan önerileri store'a yazar */
  setReceivedRecommendations: (recs) => set({ receivedRecommendations: recs }),

  /** Çıkış yapıldığında tüm öneri verilerini temizler */
  clear: () => set({ myRecommendations: [], receivedRecommendations: [] }),
}));

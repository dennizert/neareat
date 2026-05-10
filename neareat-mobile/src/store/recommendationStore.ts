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
  setMyRecommendations: (recs) => set({ myRecommendations: recs }),
  addMyRecommendation: (rec) =>
    set({ myRecommendations: [rec, ...get().myRecommendations] }),
  setReceivedRecommendations: (recs) => set({ receivedRecommendations: recs }),
  clear: () => set({ myRecommendations: [], receivedRecommendations: [] }),
}));

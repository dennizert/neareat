/**
 * AI Yemek Önerisi Store (Sprint-1 Task #7).
 *
 * Mevcut `recommendationStore` SOSYAL feature (kullanıcılar arası öneri) için.
 * Bu store AI motorunun çıktısı için ayrı tutuluyor — isim çakışması yok,
 * her ikisi de farklı amaca hizmet ediyor.
 *
 * State:
 *   - loading: API call devam ediyor mu
 *   - recommendations: son başarılı sorgudan dönen 1-3 öneri
 *   - noteToUser: LLM'in opsiyonel ekstra notu (boş olabilir)
 *   - remainingToday: free tier günlük kalan (premium = null)
 *   - resetAt: free tier reset zamanı (ISO, premium = null)
 *   - tier: 'free' | 'premium' | null (henüz çağrılmadıysa)
 *   - error: kullanıcı dostu hata mesajı (varsa)
 *   - limitReached: 429 LIMIT_EXCEEDED durumu için boolean — paywall trigger için
 *
 * Actions:
 *   - fetchDinnerRecommendation(lat, lng, mood?) — API call
 *   - clear() — logout veya yeni sorgu için reset
 */

import { create } from 'zustand';
import {
  getDinnerRecommendation,
  postFeedback,
  AiRecommendationLimitError,
  AiRecommendationNoCandidatesError,
} from '../services/aiRecommendation';
import type { AiRecommendation, FeedbackSentiment } from '../types';

interface AiRecommendationState {
  loading: boolean;
  recommendations: AiRecommendation[];
  noteToUser: string;
  remainingToday: number | null;
  resetAt: string | null;
  tier: 'free' | 'premium' | null;
  error: string | null;
  /** 429 LIMIT_EXCEEDED hit oldu mu — UI paywall yönlendirmesi için */
  limitReached: boolean;
  /** 404 NO_CANDIDATES — UI "biraz uzaklaş" mesajı için */
  noCandidates: boolean;
  /** placeId → kullanıcının verdiği feedback (optimistic) */
  feedbackByPlaceId: Record<string, FeedbackSentiment>;

  fetchDinnerRecommendation: (lat: number, lng: number, mood?: string) => Promise<void>;
  /** Optimistic feedback gönder; hata olursa rollback yapıp throw eder */
  submitFeedback: (placeId: string, sentiment: FeedbackSentiment) => Promise<void>;
  clear: () => void;
}

const INITIAL_STATE = {
  loading: false,
  recommendations: [] as AiRecommendation[],
  noteToUser: '',
  remainingToday: null as number | null,
  resetAt: null as string | null,
  tier: null as 'free' | 'premium' | null,
  error: null as string | null,
  limitReached: false,
  noCandidates: false,
  feedbackByPlaceId: {} as Record<string, FeedbackSentiment>,
};

export const useAiRecommendationStore = create<AiRecommendationState>((set) => ({
  ...INITIAL_STATE,

  async fetchDinnerRecommendation(lat, lng, mood) {
    set({
      loading: true,
      error: null,
      limitReached: false,
      noCandidates: false,
    });

    try {
      const result = await getDinnerRecommendation(lat, lng, mood);
      set({
        loading: false,
        recommendations: result.recommendations,
        noteToUser: result.noteToUser,
        remainingToday: result.remainingToday,
        resetAt: result.resetAt,
        tier: result.tier,
        error: null,
        limitReached: false,
        noCandidates: false,
      });
    } catch (err) {
      if (err instanceof AiRecommendationLimitError) {
        set({
          loading: false,
          remainingToday: 0,
          resetAt: err.resetAt,
          tier: 'free',
          limitReached: true,
          error: err.userMessage,
        });
        return;
      }
      if (err instanceof AiRecommendationNoCandidatesError) {
        set({
          loading: false,
          recommendations: [],
          noCandidates: true,
          error: err.userMessage,
        });
        return;
      }
      // Generic ağ/sunucu hatası — kullanıcı dostu mesaj
      set({
        loading: false,
        error: 'Öneri alınamadı. İnternet bağlantını kontrol edip tekrar dene.',
      });
    }
  },

  async submitFeedback(placeId, sentiment) {
    // Optimistic update
    set((s) => ({
      feedbackByPlaceId: { ...s.feedbackByPlaceId, [placeId]: sentiment },
    }));
    try {
      await postFeedback({ placeId, sentiment });
    } catch {
      // Rollback
      set((s) => {
        const next = { ...s.feedbackByPlaceId };
        delete next[placeId];
        return { feedbackByPlaceId: next };
      });
      throw new Error('Feedback gönderilemedi.');
    }
  },

  clear() {
    set({ ...INITIAL_STATE });
  },
}));

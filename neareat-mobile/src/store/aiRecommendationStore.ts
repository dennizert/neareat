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
  streamDinnerRecommendation,
  getRouteRecommendation,
  postFeedback,
  AiRecommendationLimitError,
  AiRecommendationNoCandidatesError,
} from '../services/aiRecommendation';
import type {
  AiRecommendation,
  FeedbackSentiment,
  StreamingStatus,
  RouteRecommendation,
  RouteRecommendationRequest,
} from '../types';

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
  /** SSE stream durumu — skeleton/durdur butonu kontrolü için */
  streamingStatus: StreamingStatus;
  /** Aktif SSE stream'i iptal etmek için — cancelStream() kullanır */
  abortController: AbortController | null;
  /** Rota önerisi sonuçları — sequenceOrder ile sıralı */
  routeRecommendations: RouteRecommendation[];
  routeMeta: { totalDistanceKm: number; totalDurationMin: number } | null;
  routeLoading: boolean;
  routeError: string | null;
  routeLimitReached: boolean;
  routeNoCandidates: boolean;

  fetchDinnerRecommendation: (lat: number, lng: number, mood?: string) => Promise<void>;
  /** SSE streaming versiyon — kartlar birer birer store'a push edilir */
  streamDinnerRecommendation: (lat: number, lng: number, mood?: string) => Promise<void>;
  /** Aktif SSE stream'i iptal et (Durdur butonu) */
  cancelStream: () => void;
  /** Optimistic feedback gönder; hata olursa rollback yapıp throw eder */
  submitFeedback: (placeId: string, sentiment: FeedbackSentiment) => Promise<void>;
  fetchRouteRecommendation: (params: RouteRecommendationRequest) => Promise<void>;
  resetRoute: () => void;
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
  streamingStatus: 'idle' as StreamingStatus,
  abortController: null as AbortController | null,
  routeRecommendations: [] as RouteRecommendation[],
  routeMeta: null as { totalDistanceKm: number; totalDurationMin: number } | null,
  routeLoading: false,
  routeError: null as string | null,
  routeLimitReached: false,
  routeNoCandidates: false,
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

  async streamDinnerRecommendation(lat, lng, mood) {
    const controller = new AbortController();
    set({
      loading: true,
      streamingStatus: 'streaming',
      error: null,
      limitReached: false,
      noCandidates: false,
      recommendations: [],
      noteToUser: '',
      abortController: controller,
    });

    try {
      await streamDinnerRecommendation(lat, lng, mood, {
        onCard: (rec) => {
          set((s) => ({
            loading: false, // skeleton ilk kartta kalkar
            recommendations: [...s.recommendations, rec],
          }));
        },
        onNote: (note) => {
          set({ noteToUser: note });
        },
        onDone: ({ tier, remainingToday, resetAt }) => {
          set({
            streamingStatus: 'done',
            loading: false,
            tier: tier as 'free' | 'premium',
            remainingToday,
            resetAt,
            abortController: null,
          });
        },
        onError: (event) => {
          if (event.code === 'LIMIT_EXCEEDED') {
            set({
              streamingStatus: 'error',
              loading: false,
              limitReached: true,
              remainingToday: 0,
              resetAt: event.resetAt ?? null,
              tier: 'free',
              error: event.message ?? 'Günlük öneri hakkın doldu.',
              abortController: null,
            });
            return;
          }
          if (event.code === 'NO_CANDIDATES') {
            set({
              streamingStatus: 'error',
              loading: false,
              noCandidates: true,
              error: event.message ?? 'Şu an yakınında uygun restoran bulamadık.',
              abortController: null,
            });
            return;
          }
          set({
            streamingStatus: 'error',
            loading: false,
            error: event.message ?? 'Öneri alınamadı.',
            abortController: null,
          });
        },
      }, controller.signal);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // cancelStream() tarafından iptal edildi — status zaten 'cancelled'
        return;
      }
      if (err instanceof AiRecommendationLimitError) {
        set({
          streamingStatus: 'error',
          loading: false,
          limitReached: true,
          remainingToday: 0,
          resetAt: err.resetAt,
          tier: 'free',
          error: err.userMessage,
          abortController: null,
        });
        return;
      }
      if (err instanceof AiRecommendationNoCandidatesError) {
        set({
          streamingStatus: 'error',
          loading: false,
          noCandidates: true,
          error: err.userMessage,
          abortController: null,
        });
        return;
      }
      set({
        streamingStatus: 'error',
        loading: false,
        error: 'Öneri alınamadı. İnternet bağlantını kontrol edip tekrar dene.',
        abortController: null,
      });
    }
  },

  cancelStream() {
    set((s) => {
      s.abortController?.abort();
      return { streamingStatus: 'cancelled', loading: false, abortController: null };
    });
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

  async fetchRouteRecommendation(params) {
    set({
      routeLoading: true,
      routeError: null,
      routeLimitReached: false,
      routeNoCandidates: false,
      routeRecommendations: [],
      routeMeta: null,
    });

    try {
      const result = await getRouteRecommendation(params);
      set({
        routeLoading: false,
        routeRecommendations: result.recommendations,
        routeMeta: {
          totalDistanceKm: result.totalRouteDistanceKm,
          totalDurationMin: result.totalRouteDurationMin,
        },
        routeError: null,
        routeLimitReached: false,
        routeNoCandidates: false,
      });
    } catch (err) {
      if (err instanceof AiRecommendationLimitError) {
        set({
          routeLoading: false,
          routeLimitReached: true,
          routeError: err.userMessage,
        });
        return;
      }
      if (err instanceof AiRecommendationNoCandidatesError) {
        set({
          routeLoading: false,
          routeNoCandidates: true,
          routeError: err.userMessage,
        });
        return;
      }
      set({
        routeLoading: false,
        routeError: 'Rota önerisi alınamadı. İnternet bağlantını kontrol edip tekrar dene.',
      });
    }
  },

  resetRoute() {
    set({
      routeRecommendations: [],
      routeMeta: null,
      routeLoading: false,
      routeError: null,
      routeLimitReached: false,
      routeNoCandidates: false,
    });
  },

  clear() {
    set({ ...INITIAL_STATE });
  },
}));

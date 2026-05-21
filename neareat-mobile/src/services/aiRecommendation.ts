/**
 * AI Yemek Önerisi Servisi (Sprint-1 Task #7).
 *
 * Backend endpoint: POST /api/recommendations/dinner-tonight
 *   body: { lat, lng, mood? }
 *   200: AiRecommendationResponse
 *   429: LIMIT_EXCEEDED — free tier günlük 3 hak doldu
 *   404: NO_CANDIDATES — yakında uygun restoran yok
 *
 * Bu servis backend kontratını (PR #16) frontend type-safe API call'a çevirir.
 * 429 ve 404 hataları custom error sınıfı ile typed olarak fırlatılır;
 * caller bunları `instanceof` ile yakalayabilir.
 */

import { MOCK_MODE } from '../config';
import api, { BASE_URL, getToken } from './api';
import type {
  AiRecommendation,
  AiRecommendationRequest,
  AiRecommendationResponse,
  AiRecommendationLimitInfo,
  FeedbackRequest,
  RouteRecommendationRequest,
  RouteRecommendationResponse,
} from '../types';

/**
 * Free tier günlük 3 öneri limitini aştığında fırlatılan typed error.
 *
 * Caller pattern:
 *   try {
 *     const result = await getDinnerRecommendation(lat, lng, mood);
 *     ...
 *   } catch (e) {
 *     if (e instanceof AiRecommendationLimitError) {
 *       navigation.navigate('PremiumUpsell', { resetAt: e.resetAt });
 *       return;
 *     }
 *     throw e;
 *   }
 */
export class AiRecommendationLimitError extends Error {
  /** Free tier reset zamanı (ISO). PremiumUpsell ekranında geri sayım için kullanılır. */
  readonly resetAt: string;
  /** Kullanıcıya gösterilecek mesaj (backend'ten gelir). */
  readonly userMessage: string;

  constructor(info: AiRecommendationLimitInfo) {
    super(info.message);
    this.name = 'AiRecommendationLimitError';
    this.resetAt = info.resetAt;
    this.userMessage = info.message;
    // Restore prototype chain — TS class extends Error gotcha
    Object.setPrototypeOf(this, AiRecommendationLimitError.prototype);
  }
}

/**
 * Aday restoran bulunamadığında fırlatılan typed error (404 NO_CANDIDATES).
 */
export class AiRecommendationNoCandidatesError extends Error {
  readonly userMessage: string;
  constructor(message: string) {
    super(message);
    this.name = 'AiRecommendationNoCandidatesError';
    this.userMessage = message;
    Object.setPrototypeOf(this, AiRecommendationNoCandidatesError.prototype);
  }
}

/**
 * "Bu akşam ne yesem?" — AI öneri al.
 *
 * @param lat - Kullanıcının enlem koordinatı
 * @param lng - Kullanıcının boylam koordinatı
 * @param mood - Opsiyonel mood (hızlı/şık/romantik/aile vs.)
 * @returns AI öneri response'u
 * @throws {AiRecommendationLimitError} Free tier günlük 3 hak doldu (429)
 * @throws {AiRecommendationNoCandidatesError} Yakında uygun restoran yok (404)
 * @throws Diğer ağ/sunucu hataları olduğu gibi propage edilir
 */
export async function getDinnerRecommendation(
  lat: number,
  lng: number,
  mood?: string
): Promise<AiRecommendationResponse> {
  if (MOCK_MODE) {
    // Mock mode için minimum response — geliştirme ekranlarını test ederken
    return {
      recommendations: [
        {
          placeId: 'mock_place_1',
          reason: 'Mock mode aktif — gerçek API çağrılmıyor. Bu örnek bir öneri gerekçesidir.',
          restaurant: {
            name: 'Mock Restaurant',
            types: ['restaurant'],
            rating: 4.5,
            userRatingsTotal: 100,
            priceLevel: 2,
            vicinity: 'Mock Address',
            location: { lat, lng },
            distanceKm: 0.5,
            openNow: true,
            photoUrl: null,
          },
        },
      ],
      noteToUser: '',
      tier: 'free',
      model: 'mock-model',
      remainingToday: 2,
      resetAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      latencyMs: 0,
    };
  }

  const payload: AiRecommendationRequest = { lat, lng };
  if (mood && mood.trim()) payload.mood = mood.trim();

  try {
    const { data } = await api.post<AiRecommendationResponse>(
      '/recommendations/dinner-tonight',
      payload
    );
    return data;
  } catch (err: any) {
    const status = err?.response?.status;
    const body = err?.response?.data;

    if (status === 429 && body?.error === 'LIMIT_EXCEEDED') {
      throw new AiRecommendationLimitError({
        message: body.message || 'Günlük öneri hakkın doldu.',
        resetAt: body.resetAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    if (status === 404 && body?.error === 'NO_CANDIDATES') {
      throw new AiRecommendationNoCandidatesError(
        body.message || 'Şu an yakınında uygun restoran bulamadık.'
      );
    }

    throw err;
  }
}

interface SseStreamCallbacks {
  onCard: (rec: AiRecommendation) => void;
  onNote: (note: string) => void;
  onDone: (meta: {
    tier: string;
    model: string;
    remainingToday: number | null;
    resetAt: string | null;
    latencyMs: number;
  }) => void;
  onError: (event: { code?: string; message?: string; upgrade?: boolean; resetAt?: string }) => void;
}

/**
 * SSE streaming öneri — her kart geldiğinde onCard callback çağrılır.
 * React Native 0.76 / Hermes: fetch + response.body.getReader() destekli.
 *
 * @param signal - AbortController.signal (cancelStream için)
 */
export async function streamDinnerRecommendation(
  lat: number,
  lng: number,
  mood: string | undefined,
  callbacks: SseStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 400));
    callbacks.onCard({
      placeId: 'mock_stream_p1',
      reason: 'Mock stream mode aktif — kart 1.',
      restaurant: {
        name: 'Mock Stream Restaurant',
        types: ['restaurant'],
        rating: 4.5,
        userRatingsTotal: 100,
        priceLevel: 2,
        vicinity: 'Mock Address',
        location: { lat, lng },
        distanceKm: 0.5,
        openNow: true,
        photoUrl: null,
      },
    });
    callbacks.onDone({
      tier: 'free',
      model: 'mock',
      remainingToday: 2,
      resetAt: null,
      latencyMs: 400,
    });
    return;
  }

  const token = await getToken();
  const url = `${BASE_URL}/recommendations/dinner-tonight/stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ lat, lng, ...(mood?.trim() ? { mood: mood.trim() } : {}) }),
    signal,
  });

  // SSE headers flushed edildi, ama HTTP level hata olabilir (401, 400 vb.)
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as any;
    if (response.status === 429 && body?.error === 'LIMIT_EXCEEDED') {
      throw new AiRecommendationLimitError({
        message: body.message || 'Günlük öneri hakkın doldu.',
        resetAt: body.resetAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    if (response.status === 404 && body?.error === 'NO_CANDIDATES') {
      throw new AiRecommendationNoCandidatesError(
        body.message || 'Şu an yakınında uygun restoran bulamadık.'
      );
    }
    throw new Error(`HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Streaming desteklenmiyor.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events: double-newline ayraçlı
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6)) as any;
          switch (event.type) {
            case 'card':
              callbacks.onCard(event.recommendation);
              break;
            case 'note':
              if (event.noteToUser) callbacks.onNote(event.noteToUser);
              break;
            case 'done':
              callbacks.onDone({
                tier: event.tier,
                model: event.model,
                remainingToday: event.remainingToday ?? null,
                resetAt: event.resetAt ?? null,
                latencyMs: event.latencyMs ?? 0,
              });
              break;
            case 'error':
              callbacks.onError(event);
              break;
          }
        } catch {
          // Malformed JSON chunk — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Rota üzerinde yemek önerisi al — A'dan B'ye giderken duraklar.
 *
 * @throws {AiRecommendationLimitError} 429 LIMIT_EXCEEDED
 * @throws {AiRecommendationNoCandidatesError} 404 NO_CANDIDATES veya NO_ROUTE_FOUND
 */
export async function getRouteRecommendation(
  params: RouteRecommendationRequest
): Promise<RouteRecommendationResponse> {
  if (MOCK_MODE) {
    return {
      recommendations: [
        {
          placeId: 'mock_route_p1',
          reason: 'Mock route mode aktif — 1. durak örnek öneri.',
          restaurant: {
            name: 'Mock Route Restaurant',
            types: ['restaurant'],
            rating: 4.3,
            userRatingsTotal: 80,
            priceLevel: 2,
            vicinity: 'Mock Route Address',
            location: { lat: params.originLat, lng: params.originLng },
            distanceKm: 1.2,
            openNow: true,
            photoUrl: null,
            sequenceOrder: 1,
          },
        },
      ],
      totalRouteDistanceKm: 12.5,
      totalRouteDurationMin: 25,
      noteToUser: '',
      tier: 'free',
      model: 'mock-model',
      remainingToday: 2,
      resetAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      latencyMs: 0,
    };
  }

  try {
    const { data } = await api.post<RouteRecommendationResponse>(
      '/recommendations/route-tonight',
      params,
      { timeout: 40000 } // Rota: Places API (3 waypoint) + Claude ≈ 20-25sn
    );
    return data;
  } catch (err: any) {
    const status = err?.response?.status;
    const body = err?.response?.data;

    if (status === 429 && body?.error === 'LIMIT_EXCEEDED') {
      throw new AiRecommendationLimitError({
        message: body.message || 'Günlük öneri hakkın doldu.',
        resetAt: body.resetAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    if (status === 404) {
      throw new AiRecommendationNoCandidatesError(
        body?.message || 'Rota boyunca uygun restoran bulamadık.'
      );
    }

    throw err;
  }
}

/**
 * AI öneri feedback'i gönder (👍/👎).
 */
export async function postFeedback(payload: FeedbackRequest): Promise<{ id: string }> {
  if (MOCK_MODE) return { id: 'mock-feedback-id' };
  const { data } = await api.post<{ id: string }>('/recommendations/feedback', payload);
  return data;
}

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
import api from './api';
import type {
  AiRecommendationRequest,
  AiRecommendationResponse,
  AiRecommendationLimitInfo,
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

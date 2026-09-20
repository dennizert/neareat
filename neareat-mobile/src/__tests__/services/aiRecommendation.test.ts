/**
 * #430 — aiRecommendation servisinin hata-eşleme mantığı (429 LIMIT_EXCEEDED,
 * 404 NO_CANDIDATES → typed error sınıfları) ve başarı yolu.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  BASE_URL: 'http://localhost:3000/api',
  getToken: jest.fn(),
}));

import api from '../../services/api';
import {
  getDinnerRecommendation,
  getRouteRecommendation,
  postFeedback,
  AiRecommendationLimitError,
  AiRecommendationNoCandidatesError,
} from '../../services/aiRecommendation';

const mockedPost = (api as any).post as jest.Mock;

beforeEach(() => jest.clearAllMocks());

function axiosError(status: number, data: any) {
  return { response: { status, data } };
}

describe('getDinnerRecommendation', () => {
  it('doğru endpoint ve payload ile başarılı yanıtı döner', async () => {
    const payload = { recommendations: [], noteToUser: '', tier: 'free', model: 'x', remainingToday: 2, resetAt: '', latencyMs: 10 };
    mockedPost.mockResolvedValueOnce({ data: payload });

    const result = await getDinnerRecommendation(41.0, 29.0);

    expect(mockedPost).toHaveBeenCalledWith(
      '/recommendations/dinner-tonight',
      { lat: 41.0, lng: 29.0 },
      { timeout: 40000 },
    );
    expect(result).toEqual(payload);
  });

  it('429 LIMIT_EXCEEDED → AiRecommendationLimitError, backend mesajı ve resetAt korunur', async () => {
    mockedPost.mockRejectedValueOnce(
      axiosError(429, { error: 'LIMIT_EXCEEDED', message: 'Hakkın doldu', resetAt: '2026-06-16T00:00:00Z' }),
    );

    let caught: any;
    try {
      await getDinnerRecommendation(0, 0);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AiRecommendationLimitError);
    expect(caught.userMessage).toBe('Hakkın doldu');
    expect(caught.resetAt).toBe('2026-06-16T00:00:00Z');
  });

  it('429 LIMIT_EXCEEDED ama backend mesaj/resetAt vermezse varsayılana düşer', async () => {
    mockedPost.mockRejectedValueOnce(axiosError(429, { error: 'LIMIT_EXCEEDED' }));

    try {
      await getDinnerRecommendation(0, 0);
      throw new Error('beklenen hata fırlatılmadı');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AiRecommendationLimitError);
      expect(e.userMessage).toBe('Günlük öneri hakkın doldu.');
      expect(typeof e.resetAt).toBe('string');
    }
  });

  it('404 NO_CANDIDATES → AiRecommendationNoCandidatesError', async () => {
    mockedPost.mockRejectedValueOnce(axiosError(404, { error: 'NO_CANDIDATES', message: 'Bulunamadı' }));

    await expect(getDinnerRecommendation(0, 0)).rejects.toThrow(AiRecommendationNoCandidatesError);
  });

  it('eşlenmeyen hatalar (ör. 500) olduğu gibi fırlatılır', async () => {
    const err = axiosError(500, { error: 'INTERNAL' });
    mockedPost.mockRejectedValueOnce(err);

    await expect(getDinnerRecommendation(0, 0)).rejects.toBe(err);
  });
});

describe('getRouteRecommendation', () => {
  const params = { originLat: 1, originLng: 2, destLat: 3, destLng: 4 } as any;

  it('doğru endpoint ile başarılı yanıtı döner', async () => {
    const payload = { recommendations: [], totalRouteDistanceKm: 1, totalRouteDurationMin: 1, noteToUser: '', tier: 'free', model: 'x', remainingToday: 1, resetAt: '', latencyMs: 1 };
    mockedPost.mockResolvedValueOnce({ data: payload });

    const result = await getRouteRecommendation(params);

    expect(mockedPost).toHaveBeenCalledWith('/recommendations/route-tonight', params, { timeout: 40000 });
    expect(result).toEqual(payload);
  });

  it('429 LIMIT_EXCEEDED → AiRecommendationLimitError', async () => {
    mockedPost.mockRejectedValueOnce(axiosError(429, { error: 'LIMIT_EXCEEDED', message: 'm', resetAt: 'r' }));
    await expect(getRouteRecommendation(params)).rejects.toThrow(AiRecommendationLimitError);
  });

  it('404 (herhangi bir error koduyla) → AiRecommendationNoCandidatesError', async () => {
    mockedPost.mockRejectedValueOnce(axiosError(404, { message: 'Rota boyunca bulunamadı' }));
    await expect(getRouteRecommendation(params)).rejects.toThrow(AiRecommendationNoCandidatesError);
  });

  it('eşlenmeyen hatalar olduğu gibi fırlatılır', async () => {
    const err = axiosError(500, {});
    mockedPost.mockRejectedValueOnce(err);
    await expect(getRouteRecommendation(params)).rejects.toBe(err);
  });
});

describe('postFeedback', () => {
  it('doğru endpoint ve payload ile gönderir', async () => {
    mockedPost.mockResolvedValueOnce({ data: { id: 'fb-1' } });
    const result = await postFeedback({ placeId: 'p1', helpful: true } as any);
    expect(mockedPost).toHaveBeenCalledWith('/recommendations/feedback', { placeId: 'p1', helpful: true });
    expect(result).toEqual({ id: 'fb-1' });
  });
});

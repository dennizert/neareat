/**
 * backendAnalyticsSink — kendi backend'imize yazan sink implementasyonu (#481).
 *
 * `services/analytics.ts` sağlayıcı-agnostiktir; bu test sink'in KENDİSİNİN doğru
 * uca, doğru gövdeyle, hatayı yutarak POST attığını doğrular.
 */
const mockPost = jest.fn();
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { post: (...args: unknown[]) => mockPost(...args) },
}));

import { backendAnalyticsSink } from '../../services/analyticsBackendSink';

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue({ data: { received: true } });
});

describe('backendAnalyticsSink', () => {
  it('doğru uca, ad ve props ile POST atar', () => {
    backendAnalyticsSink('restaurant_detail_open', { placeId: 'p1' });
    expect(mockPost).toHaveBeenCalledWith('/analytics/events', {
      name: 'restaurant_detail_open',
      props: { placeId: 'p1' },
    });
  });

  it('props verilmezse undefined olarak gönderilir', () => {
    backendAnalyticsSink('ai_recommendation_requested', undefined);
    expect(mockPost).toHaveBeenCalledWith('/analytics/events', {
      name: 'ai_recommendation_requested',
      props: undefined,
    });
  });

  // ASIL GEREKSİNİM: bu sink `trackEvent`'in senkron try/catch'i içinde çağrılır
  // ama axios.post ASENKRON — bir promise reddi normal try/catch tarafından
  // YAKALANMAZ. Sink kendi .catch()'ini taşımazsa unhandled rejection üretirdi.
  it('ağ/sunucu hatası sessizce yutulur (unhandled rejection üretmez)', async () => {
    mockPost.mockRejectedValue(new Error('network error'));
    expect(() => backendAnalyticsSink('x', {})).not.toThrow();
    // mikro görev kuyruğunun reddi işlemesini bekle — patlarsa test çalıştırıcı yakalar
    await new Promise((r) => setTimeout(r, 0));
  });

  it('senkron çağrı hiçbir şey döndürmez (fire-and-forget, trackEvent onu beklemez)', () => {
    const result = backendAnalyticsSink('x');
    expect(result).toBeUndefined();
  });
});

/**
 * #430 — discovery.ts: getRecentlyViewed'ın backend alan-eksikliğine karşı boş
 * diziye düşmesi ve recordPlaceView'ın fire-and-forget hata yutması.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '../../services/api';
import { getPersonalizedDiscovery, getRecentlyViewed, recordPlaceView } from '../../services/discovery';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('getPersonalizedDiscovery', () => {
  it('lat/lng params ile çağırır', async () => {
    const payload = { tasteProfile: { topCuisines: [] }, recentlyViewed: [], forYou: [], revisit: [], radiusKm: 5 };
    mockedApi.get.mockResolvedValueOnce({ data: payload });
    await getPersonalizedDiscovery(1, 2);
    expect(mockedApi.get).toHaveBeenCalledWith('/places/personalized', { params: { lat: 1, lng: 2 } });
  });
});

describe('getRecentlyViewed', () => {
  it('backend recentlyViewed alanını çıkarır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { recentlyViewed: [{ placeId: 'p1' }] } });
    const result = await getRecentlyViewed();
    expect(result).toEqual([{ placeId: 'p1' }]);
  });

  it('alan eksikse boş diziye düşer (patlamaz)', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {} });
    const result = await getRecentlyViewed();
    expect(result).toEqual([]);
  });
});

describe('recordPlaceView — fire-and-forget', () => {
  const place = { placeId: 'p1', name: 'X', rating: 4, photoUrl: 'x.jpg', types: ['cafe'] };

  it('eksik alanları null/[] varsayılanına düşürüp POST eder', async () => {
    mockedApi.post.mockResolvedValueOnce({});
    await recordPlaceView(place);
    expect(mockedApi.post).toHaveBeenCalledWith('/places/view', {
      placeId: 'p1', placeName: 'X', placeAddress: null, placePhotoUrl: 'x.jpg', placeRating: 4, placeTypes: ['cafe'],
    });
  });

  it('backend hata verirse sessizce yutar (throw etmez)', async () => {
    mockedApi.post.mockRejectedValueOnce(new Error('network'));
    await expect(recordPlaceView(place)).resolves.toBeUndefined();
  });
});

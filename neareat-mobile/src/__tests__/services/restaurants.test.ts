/**
 * #430 — restaurants.ts servis katmanı: ağ hatasında offline-cache fallback
 * mantığı ve fetchAppReviews'ın backend'in eski/yeni (dizi vs. sayfalı) yanıt
 * şekillerini normalize etmesi (MOCK_MODE=false, üretim yolu).
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

jest.mock('../../services/offlineCache', () => ({
  saveCache: jest.fn(),
  loadCache: jest.fn(),
  isNetworkError: jest.fn(),
}));

import api from '../../services/api';
import * as offlineCache from '../../services/offlineCache';
import {
  fetchNearby,
  searchPlaces,
  fetchRestaurantDetail,
  fetchAppReviews,
  createReview,
  updateReview,
  deleteReview,
} from '../../services/restaurants';

const mockedApi = api as any;
const mockedCache = offlineCache as jest.Mocked<typeof offlineCache>;
beforeEach(() => jest.clearAllMocks());

describe('fetchNearby', () => {
  it('başarılı yanıtı önbelleğe alır ve döner', async () => {
    const payload = { results: [], radiusKm: 5 };
    mockedApi.get.mockResolvedValueOnce({ data: payload });

    const result = await fetchNearby(41.111, 29.222, 'cafe');

    expect(mockedApi.get).toHaveBeenCalledWith('/restaurants/nearby', { params: { lat: 41.111, lng: 29.222, type: 'cafe' } });
    expect(mockedCache.saveCache).toHaveBeenCalledWith('nearby:cafe:41.11:29.22', payload);
    expect(result).toEqual(payload);
  });

  it('ağ hatasında ve önbellek varsa önbellekten döner (throw etmez)', async () => {
    const err = new Error('network');
    mockedApi.get.mockRejectedValueOnce(err);
    mockedCache.isNetworkError.mockReturnValueOnce(true);
    const cached = { results: [{ placeId: 'p1' }], radiusKm: 5 };
    mockedCache.loadCache.mockResolvedValueOnce(cached as any);

    const result = await fetchNearby(1, 2);

    expect(result).toEqual(cached);
  });

  it('ağ hatası ama önbellek yoksa hatayı fırlatır', async () => {
    const err = new Error('network');
    mockedApi.get.mockRejectedValueOnce(err);
    mockedCache.isNetworkError.mockReturnValueOnce(true);
    mockedCache.loadCache.mockResolvedValueOnce(null);

    await expect(fetchNearby(1, 2)).rejects.toBe(err);
  });

  it('ağ hatası değilse (ör. 500) önbelleğe bakmadan hatayı fırlatır', async () => {
    const err = new Error('server error');
    mockedApi.get.mockRejectedValueOnce(err);
    mockedCache.isNetworkError.mockReturnValueOnce(false);

    await expect(fetchNearby(1, 2)).rejects.toBe(err);
    expect(mockedCache.loadCache).not.toHaveBeenCalled();
  });
});

describe('searchPlaces', () => {
  it('lat/lng verilmezse query’de yer almaz', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { results: [], query: 'kebap' } });
    await searchPlaces('kebap');
    expect(mockedApi.get).toHaveBeenCalledWith('/places/search', { params: { q: 'kebap' } });
  });

  it('lat/lng verilirse konum bias parametreleri eklenir', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { results: [], query: 'kebap' } });
    await searchPlaces('kebap', 41, 29);
    expect(mockedApi.get).toHaveBeenCalledWith('/places/search', { params: { q: 'kebap', lat: 41, lng: 29 } });
  });
});

describe('fetchRestaurantDetail', () => {
  it('başarılı yanıtı önbelleğe alır ve döner', async () => {
    const payload = { placeId: 'p1', name: 'X' };
    mockedApi.get.mockResolvedValueOnce({ data: payload });

    const result = await fetchRestaurantDetail('p1', 1, 2);

    expect(mockedApi.get).toHaveBeenCalledWith('/restaurants/p1', { params: { lat: 1, lng: 2 } });
    expect(mockedCache.saveCache).toHaveBeenCalledWith('detail:p1', payload);
    expect(result).toEqual(payload);
  });

  it('ağ hatasında önbellekten döner', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('network'));
    mockedCache.isNetworkError.mockReturnValueOnce(true);
    const cached = { placeId: 'p1', name: 'Cache' };
    mockedCache.loadCache.mockResolvedValueOnce(cached as any);

    const result = await fetchRestaurantDetail('p1');

    expect(result).toEqual(cached);
  });
});

describe('fetchAppReviews — eski/yeni backend şekli normalizasyonu', () => {
  it('backend düz dizi dönerse olduğu gibi kullanır (eski şekil)', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ id: 'r1' }] });
    const result = await fetchAppReviews('p1');
    expect(mockedApi.get).toHaveBeenCalledWith('/reviews/p1', { params: { limit: 100 } });
    expect(result).toEqual([{ id: 'r1' }]);
  });

  it('backend sayfalı obje dönerse reviews alanını çıkarır (yeni şekil)', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { reviews: [{ id: 'r2' }], hasMore: true, nextCursor: 'c1' } });
    const result = await fetchAppReviews('p1');
    expect(result).toEqual([{ id: 'r2' }]);
  });

  it('sayfalı obje reviews alanı yoksa boş dizi döner', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { hasMore: false } });
    const result = await fetchAppReviews('p1');
    expect(result).toEqual([]);
  });
});

describe('yorum CRUD', () => {
  it('createReview placeId/rating/body/placeName ile POST atar', async () => {
    const payload = { review: {}, starEvent: null, newStarCount: null, newRewards: [] };
    mockedApi.post.mockResolvedValueOnce({ data: payload });
    const result = await createReview('p1', 5, 'harika', 'Lokanta');
    expect(mockedApi.post).toHaveBeenCalledWith('/reviews', { placeId: 'p1', rating: 5, body: 'harika', placeName: 'Lokanta' });
    expect(result).toEqual(payload);
  });

  it('updateReview doğru path ile PUT atar', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: { id: 'rev1', rating: 4 } });
    await updateReview('rev1', 4, 'güncellendi');
    expect(mockedApi.put).toHaveBeenCalledWith('/reviews/rev1', { rating: 4, body: 'güncellendi' });
  });

  it('deleteReview doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await deleteReview('rev1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/reviews/rev1');
  });
});

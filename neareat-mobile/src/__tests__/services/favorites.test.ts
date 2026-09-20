/**
 * #430 — favorites.ts servis katmanı: ağ hatasında offline-cache fallback ve
 * restaurant → favorite payload dönüşümünün (eksik alan varsayılanları dahil)
 * doğruluğu.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

jest.mock('../../services/offlineCache', () => ({
  saveCache: jest.fn(),
  loadCache: jest.fn(),
  isNetworkError: jest.fn(),
}));

import api from '../../services/api';
import * as offlineCache from '../../services/offlineCache';
import { fetchFavorites, addFavorite, addFavoriteFromRestaurant, removeFavorite } from '../../services/favorites';
import type { RestaurantDetail, Restaurant } from '../../types';

const mockedApi = api as any;
const mockedCache = offlineCache as jest.Mocked<typeof offlineCache>;
beforeEach(() => jest.clearAllMocks());

describe('fetchFavorites', () => {
  it('başarılı yanıtı önbelleğe alır ve döner', async () => {
    const payload = [{ id: 'f1' }];
    mockedApi.get.mockResolvedValueOnce({ data: payload });
    const result = await fetchFavorites();
    expect(mockedApi.get).toHaveBeenCalledWith('/favorites');
    expect(mockedCache.saveCache).toHaveBeenCalledWith('favorites', payload);
    expect(result).toEqual(payload);
  });

  it('ağ hatasında önbellekten döner', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('network'));
    mockedCache.isNetworkError.mockReturnValueOnce(true);
    const cached = [{ id: 'cached1' }];
    mockedCache.loadCache.mockResolvedValueOnce(cached as any);

    const result = await fetchFavorites();
    expect(result).toEqual(cached);
  });

  it('ağ hatası değilse hatayı fırlatır', async () => {
    const err = new Error('500');
    mockedApi.get.mockRejectedValueOnce(err);
    mockedCache.isNetworkError.mockReturnValueOnce(false);
    await expect(fetchFavorites()).rejects.toBe(err);
  });
});

describe('addFavorite — RestaurantDetail → payload dönüşümü', () => {
  const detail: RestaurantDetail = {
    placeId: 'p1',
    name: 'Lokanta',
    formattedAddress: 'Adres 1',
    location: { lat: 1, lng: 2 },
    formattedPhoneNumber: '+90 555',
    photos: ['photo1.jpg', 'photo2.jpg'],
    rating: 4.5,
  } as any;

  it('tüm alanları backend şemasına çevirir', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'fav1' } });
    await addFavorite(detail);
    expect(mockedApi.post).toHaveBeenCalledWith('/favorites', {
      placeId: 'p1', placeName: 'Lokanta', placeAddress: 'Adres 1',
      placeLat: 1, placeLng: 2, placePhone: '+90 555',
      placePhotoUrl: 'photo1.jpg', placeRating: 4.5,
    });
  });

  it('fotoğraf yoksa placePhotoUrl null olur', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: {} });
    await addFavorite({ ...detail, photos: undefined } as any);
    expect(mockedApi.post).toHaveBeenCalledWith('/favorites', expect.objectContaining({ placePhotoUrl: null }));
  });
});

describe('addFavoriteFromRestaurant — Restaurant (liste verisi) → payload dönüşümü', () => {
  const r: Restaurant = {
    placeId: 'p2', name: 'Cafe', formattedAddress: undefined,
    location: { lat: 3, lng: 4 }, photoUrl: 'x.jpg', rating: undefined,
  } as any;

  it('telefon her zaman null, eksik alanlar null’a düşer', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'fav2' } });
    await addFavoriteFromRestaurant(r);
    expect(mockedApi.post).toHaveBeenCalledWith('/favorites', {
      placeId: 'p2', placeName: 'Cafe', placeAddress: null,
      placeLat: 3, placeLng: 4, placePhone: null,
      placePhotoUrl: 'x.jpg', placeRating: null,
    });
  });
});

describe('removeFavorite', () => {
  it('doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await removeFavorite('p1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/favorites/p1');
  });
});

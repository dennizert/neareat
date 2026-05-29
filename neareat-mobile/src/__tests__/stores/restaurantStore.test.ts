/**
 * restaurantStore Tests — Sprint-6 #83 (arama).
 *
 * `searchPlaces` servisi mock'lanır; performSearch'ün loading/results/error
 * state geçişleri ve boş sorgu erken çıkışı doğrulanır.
 */

jest.mock('../../services/restaurants', () => {
  const actual = jest.requireActual('../../services/restaurants');
  return { ...actual, searchPlaces: jest.fn() };
});

import { useRestaurantStore } from '../../store/restaurantStore';
import { searchPlaces } from '../../services/restaurants';
import type { Restaurant } from '../../types';

const mockedSearch = searchPlaces as jest.MockedFunction<typeof searchPlaces>;

const INITIAL_STATE = {
  restaurants: [],
  loading: false,
  error: null,
  sortBy: 'distance' as const,
  filters: { cuisineTypes: [], openNow: false, priceLevels: [] },
  viewMode: 'list' as const,
  selectedCategory: 'all',
  searchQuery: '',
  searchResults: [],
  searchLoading: false,
  searchError: null,
};

const sampleRestaurant: Restaurant = {
  placeId: 'p1',
  name: 'Tarihi Pizza',
  rating: 4.6,
  userRatingsTotal: 120,
  priceLevel: 2,
  types: ['restaurant'],
  isOpenNow: true,
  location: { lat: 41.012, lng: 28.974 },
  distanceKm: 1.2,
  photoUrl: null,
  discount: null,
  announcement: null,
  acceptsReservations: false,
};

beforeEach(() => {
  useRestaurantStore.setState(INITIAL_STATE);
  jest.clearAllMocks();
});

describe('restaurantStore — search', () => {
  it('başlangıçta arama state\'i temiz', () => {
    const s = useRestaurantStore.getState();
    expect(s.searchQuery).toBe('');
    expect(s.searchResults).toEqual([]);
    expect(s.searchLoading).toBe(false);
    expect(s.searchError).toBeNull();
  });

  it('setSearchQuery sadece sorgu metnini günceller', () => {
    useRestaurantStore.getState().setSearchQuery('pizza');
    expect(useRestaurantStore.getState().searchQuery).toBe('pizza');
    expect(useRestaurantStore.getState().searchResults).toEqual([]);
  });

  it('boş/kısa sorgu → servis çağrılmaz, results temizlenir', async () => {
    useRestaurantStore.setState({ searchResults: [sampleRestaurant] });
    await useRestaurantStore.getState().performSearch('');
    expect(mockedSearch).not.toHaveBeenCalled();
    expect(useRestaurantStore.getState().searchResults).toEqual([]);
    expect(useRestaurantStore.getState().searchLoading).toBe(false);
  });

  it('1 karakter de servis çağrılmaz', async () => {
    await useRestaurantStore.getState().performSearch('p');
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it('başarılı arama → results dolu, loading false', async () => {
    mockedSearch.mockResolvedValueOnce({ results: [sampleRestaurant], query: 'pizza' });
    await useRestaurantStore.getState().performSearch('pizza', 41, 29);
    expect(mockedSearch).toHaveBeenCalledWith('pizza', 41, 29);
    const s = useRestaurantStore.getState();
    expect(s.searchResults).toEqual([sampleRestaurant]);
    expect(s.searchLoading).toBe(false);
    expect(s.searchError).toBeNull();
  });

  it('hata → searchError set, results boş', async () => {
    mockedSearch.mockRejectedValueOnce(new Error('Ağ hatası'));
    await useRestaurantStore.getState().performSearch('pizza');
    const s = useRestaurantStore.getState();
    expect(s.searchError).toBe('Ağ hatası');
    expect(s.searchResults).toEqual([]);
    expect(s.searchLoading).toBe(false);
  });

  it('clearSearch tüm arama state\'ini temizler', () => {
    useRestaurantStore.setState({
      searchQuery: 'pizza',
      searchResults: [sampleRestaurant],
      searchError: 'oops',
    });
    useRestaurantStore.getState().clearSearch();
    const s = useRestaurantStore.getState();
    expect(s.searchQuery).toBe('');
    expect(s.searchResults).toEqual([]);
    expect(s.searchError).toBeNull();
    expect(s.searchLoading).toBe(false);
  });
});

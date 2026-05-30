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

jest.mock('../../services/searchHistory', () => ({
  getSearchHistory: jest.fn(),
  clearSearchHistory: jest.fn(),
  deleteSearchHistoryItem: jest.fn(),
}));

import { useRestaurantStore } from '../../store/restaurantStore';
import { searchPlaces } from '../../services/restaurants';
import * as historyService from '../../services/searchHistory';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Restaurant } from '../../types';

const mockedSearch = searchPlaces as jest.MockedFunction<typeof searchPlaces>;
const mockedGetHistory = historyService.getSearchHistory as jest.MockedFunction<typeof historyService.getSearchHistory>;
const mockedClearHistory = historyService.clearSearchHistory as jest.MockedFunction<typeof historyService.clearSearchHistory>;
const mockedDeleteHistoryItem = historyService.deleteSearchHistoryItem as jest.MockedFunction<typeof historyService.deleteSearchHistoryItem>;

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
  searchHistory: [] as historyService.SearchHistoryItem[],
  searchHistoryLoading: false,
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

  it('filtre / sort / kategori AsyncStorage\'a yazılır, runtime state hariç (#84)', async () => {
    useRestaurantStore.setState({
      restaurants: [sampleRestaurant],            // runtime — persist edilmemeli
      searchResults: [sampleRestaurant],          // runtime — persist edilmemeli
    });
    useRestaurantStore.getState().setSortBy('rating');
    useRestaurantStore.getState().setFilters({ openNow: true });
    useRestaurantStore.getState().setSelectedCategory('cafe');

    // persist debounce sonrası AsyncStorage'da slice'ı bekliyoruz
    await new Promise((r) => setTimeout(r, 0));
    const raw = await AsyncStorage.getItem('neareat-restaurant-filters');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.sortBy).toBe('rating');
    expect(parsed.state.filters.openNow).toBe(true);
    expect(parsed.state.selectedCategory).toBe('cafe');
    expect(parsed.state.restaurants).toBeUndefined();
    expect(parsed.state.searchResults).toBeUndefined();
  });

  describe('search history (S6-7)', () => {
    it('loadSearchHistory backend\'den listeyi alır', async () => {
      const items: historyService.SearchHistoryItem[] = [
        { id: 'h1', query: 'kebap', type: 'free_text', createdAt: '2026-05-30T10:00:00Z' },
      ];
      mockedGetHistory.mockResolvedValueOnce(items);
      await useRestaurantStore.getState().loadSearchHistory();
      expect(useRestaurantStore.getState().searchHistory).toEqual(items);
      expect(useRestaurantStore.getState().searchHistoryLoading).toBe(false);
    });

    it('clearSearchHistory store\'u boşaltır ve silinen sayısını döner', async () => {
      useRestaurantStore.setState({
        searchHistory: [{ id: 'h1', query: 'pizza', type: 'free_text', createdAt: '2026-05-30T10:00:00Z' }],
      });
      mockedClearHistory.mockResolvedValueOnce(3);
      const deleted = await useRestaurantStore.getState().clearSearchHistory();
      expect(deleted).toBe(3);
      expect(useRestaurantStore.getState().searchHistory).toEqual([]);
    });

    it('deleteSearchHistoryItem optimistic — başarılı', async () => {
      const items: historyService.SearchHistoryItem[] = [
        { id: 'h1', query: 'kebap', type: 'free_text', createdAt: '2026-05-30T10:00:00Z' },
        { id: 'h2', query: 'pizza', type: 'free_text', createdAt: '2026-05-30T09:00:00Z' },
      ];
      useRestaurantStore.setState({ searchHistory: items });
      mockedDeleteHistoryItem.mockResolvedValueOnce(undefined);
      await useRestaurantStore.getState().deleteSearchHistoryItem('h1');
      expect(useRestaurantStore.getState().searchHistory).toHaveLength(1);
      expect(useRestaurantStore.getState().searchHistory[0].id).toBe('h2');
    });

    it('deleteSearchHistoryItem hata olursa eski listeye döner', async () => {
      const items: historyService.SearchHistoryItem[] = [
        { id: 'h1', query: 'kebap', type: 'free_text', createdAt: '2026-05-30T10:00:00Z' },
      ];
      useRestaurantStore.setState({ searchHistory: items });
      mockedDeleteHistoryItem.mockRejectedValueOnce(new Error('500'));
      await expect(useRestaurantStore.getState().deleteSearchHistoryItem('h1')).rejects.toThrow();
      expect(useRestaurantStore.getState().searchHistory).toEqual(items);
    });
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

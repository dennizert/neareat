/**
 * Kişiselleştirilmiş Keşfet saf karar yardımcıları (Sprint-17 #366).
 * Ray gösterimi / kişiselleştirme aktiflik kararı / forYou birleştirme.
 */
import {
  isPersonalizationActive,
  shouldShowRails,
  mergeForYou,
} from '../../utils/personalization';
import type { PersonalizedDiscovery, Restaurant } from '../../types';

const place = (placeId: string): Restaurant => ({
  placeId,
  name: placeId,
  rating: 4,
  userRatingsTotal: 10,
  priceLevel: null,
  types: [],
  isOpenNow: true,
  location: { lat: 0, lng: 0 },
  distanceKm: 1,
  photoUrl: null,
});

const discovery = (over: Partial<PersonalizedDiscovery> = {}): PersonalizedDiscovery => ({
  tasteProfile: { topCuisines: [] },
  recentlyViewed: [],
  forYou: [],
  revisit: [],
  radiusKm: 5,
  ...over,
});

describe('isPersonalizationActive', () => {
  it('forYou doluyken + arama/filtre yokken aktif', () => {
    expect(isPersonalizationActive({
      isSearching: false, selectedCuisineTag: null, personalized: discovery({ forYou: [place('a')] }),
    })).toBe(true);
  });

  it('arama varken pasif', () => {
    expect(isPersonalizationActive({
      isSearching: true, selectedCuisineTag: null, personalized: discovery({ forYou: [place('a')] }),
    })).toBe(false);
  });

  it('mutfak filtresi seçiliyken pasif', () => {
    expect(isPersonalizationActive({
      isSearching: false, selectedCuisineTag: 'Kebap', personalized: discovery({ forYou: [place('a')] }),
    })).toBe(false);
  });

  it('personalized null veya forYou boşsa pasif', () => {
    expect(isPersonalizationActive({ isSearching: false, selectedCuisineTag: null, personalized: null })).toBe(false);
    expect(isPersonalizationActive({ isSearching: false, selectedCuisineTag: null, personalized: discovery() })).toBe(false);
  });
});

describe('shouldShowRails', () => {
  it('liste modunda + recentlyViewed/revisit doluyken gösterir', () => {
    expect(shouldShowRails({
      viewMode: 'list', isSearching: false, selectedCuisineTag: null,
      personalized: discovery({ recentlyViewed: [{ placeId: 'a', name: 'A', address: null, photoUrl: null, rating: 4, types: [], viewedAt: '' }] }),
    })).toBe(true);
  });

  it('harita modunda gizler', () => {
    expect(shouldShowRails({
      viewMode: 'map', isSearching: false, selectedCuisineTag: null,
      personalized: discovery({ revisit: [place('a')] }),
    })).toBe(false);
  });

  it('hiç ray verisi yoksa gizler', () => {
    expect(shouldShowRails({
      viewMode: 'list', isSearching: false, selectedCuisineTag: null, personalized: discovery(),
    })).toBe(false);
  });
});

describe('mergeForYou', () => {
  it('forYou önce gelir, kalan nearby mükerrer olmadan eklenir', () => {
    const merged = mergeForYou([place('b')], [place('a'), place('b'), place('c')]);
    expect(merged.map((r) => r.placeId)).toEqual(['b', 'a', 'c']);
  });

  it('boş forYou → nearby aynen', () => {
    expect(mergeForYou([], [place('a')]).map((r) => r.placeId)).toEqual(['a']);
  });
});

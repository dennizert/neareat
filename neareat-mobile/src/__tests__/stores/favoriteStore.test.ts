/**
 * favoriteStore Tests
 *
 * Tests for the Zustand-based favorite store.
 * No native modules are used — no mocks required.
 * Store state is reset before each test to prevent cross-test pollution.
 */

import { useFavoriteStore } from '../../store/favoriteStore';
import type { Favorite } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  favorites: [],
};

function resetStore() {
  useFavoriteStore.setState(INITIAL_STATE);
}

let idCounter = 0;
function makeFavorite(placeId: string, overrides: Partial<Favorite> = {}): Favorite {
  idCounter++;
  return {
    id: `fav-${idCounter}`,
    placeId,
    placeName: `Restaurant ${placeId}`,
    placeAddress: '123 Main St',
    placeLat: 41.0,
    placeLng: 29.0,
    placePhone: null,
    placePhotoUrl: null,
    placeRating: 4.5,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
});

describe('favoriteStore — initial state', () => {
  it('favorites is an empty array', () => {
    expect(useFavoriteStore.getState().favorites).toEqual([]);
  });
});

describe('favoriteStore — setFavorites()', () => {
  it('replaces the favorites array with the new list', () => {
    const list = [makeFavorite('place-1'), makeFavorite('place-2')];
    useFavoriteStore.getState().setFavorites(list);
    expect(useFavoriteStore.getState().favorites).toEqual(list);
  });

  it('replaces an existing list entirely (not appending)', () => {
    const initial = [makeFavorite('place-1')];
    useFavoriteStore.setState({ favorites: initial });

    const newList = [makeFavorite('place-2'), makeFavorite('place-3')];
    useFavoriteStore.getState().setFavorites(newList);

    const { favorites } = useFavoriteStore.getState();
    expect(favorites).toHaveLength(2);
    expect(favorites[0].placeId).toBe('place-2');
  });

  it('can set favorites to an empty array', () => {
    useFavoriteStore.setState({ favorites: [makeFavorite('place-1')] });
    useFavoriteStore.getState().setFavorites([]);
    expect(useFavoriteStore.getState().favorites).toEqual([]);
  });
});

describe('favoriteStore — addFavorite()', () => {
  it('adds a favorite to an empty list', () => {
    const fav = makeFavorite('place-1');
    useFavoriteStore.getState().addFavorite(fav);
    expect(useFavoriteStore.getState().favorites).toHaveLength(1);
    expect(useFavoriteStore.getState().favorites[0]).toEqual(fav);
  });

  it('prepends the new favorite to the front of the list', () => {
    const existingFav = makeFavorite('place-1');
    useFavoriteStore.setState({ favorites: [existingFav] });

    const newFav = makeFavorite('place-2');
    useFavoriteStore.getState().addFavorite(newFav);

    const { favorites } = useFavoriteStore.getState();
    expect(favorites[0].placeId).toBe('place-2');
    expect(favorites[1].placeId).toBe('place-1');
  });

  it('increments the favorites count by 1', () => {
    useFavoriteStore.setState({ favorites: [makeFavorite('place-A'), makeFavorite('place-B')] });
    useFavoriteStore.getState().addFavorite(makeFavorite('place-C'));
    expect(useFavoriteStore.getState().favorites).toHaveLength(3);
  });

  it('adding a duplicate placeId results in two entries (no dedup)', () => {
    // The store does not deduplicate — optimistic UI handles this at the call site
    const fav1 = makeFavorite('same-place');
    const fav2 = makeFavorite('same-place');
    useFavoriteStore.getState().addFavorite(fav1);
    useFavoriteStore.getState().addFavorite(fav2);
    expect(useFavoriteStore.getState().favorites).toHaveLength(2);
  });
});

describe('favoriteStore — removeFavorite()', () => {
  it('removes the favorite with the given placeId', () => {
    const fav = makeFavorite('place-1');
    useFavoriteStore.setState({ favorites: [fav] });

    useFavoriteStore.getState().removeFavorite('place-1');

    expect(useFavoriteStore.getState().favorites).toHaveLength(0);
  });

  it('removes only the matching favorite, leaving others intact', () => {
    const fav1 = makeFavorite('place-1');
    const fav2 = makeFavorite('place-2');
    const fav3 = makeFavorite('place-3');
    useFavoriteStore.setState({ favorites: [fav1, fav2, fav3] });

    useFavoriteStore.getState().removeFavorite('place-2');

    const { favorites } = useFavoriteStore.getState();
    expect(favorites).toHaveLength(2);
    expect(favorites.map(f => f.placeId)).toEqual(['place-1', 'place-3']);
  });

  it('does nothing when the placeId does not exist in the list', () => {
    const fav = makeFavorite('place-1');
    useFavoriteStore.setState({ favorites: [fav] });

    useFavoriteStore.getState().removeFavorite('non-existent');

    expect(useFavoriteStore.getState().favorites).toHaveLength(1);
  });

  it('handles removing from an empty list without throwing', () => {
    expect(() => {
      useFavoriteStore.getState().removeFavorite('place-1');
    }).not.toThrow();
    expect(useFavoriteStore.getState().favorites).toEqual([]);
  });
});

describe('favoriteStore — isFavorite()', () => {
  it('returns true for a placeId that exists in favorites', () => {
    const fav = makeFavorite('place-1');
    useFavoriteStore.setState({ favorites: [fav] });

    expect(useFavoriteStore.getState().isFavorite('place-1')).toBe(true);
  });

  it('returns false for a placeId that is not in favorites', () => {
    const fav = makeFavorite('place-1');
    useFavoriteStore.setState({ favorites: [fav] });

    expect(useFavoriteStore.getState().isFavorite('place-999')).toBe(false);
  });

  it('returns false when the favorites list is empty', () => {
    expect(useFavoriteStore.getState().isFavorite('place-1')).toBe(false);
  });

  it('returns true immediately after addFavorite()', () => {
    const fav = makeFavorite('place-new');
    useFavoriteStore.getState().addFavorite(fav);
    expect(useFavoriteStore.getState().isFavorite('place-new')).toBe(true);
  });

  it('returns false immediately after removeFavorite()', () => {
    const fav = makeFavorite('place-1');
    useFavoriteStore.setState({ favorites: [fav] });

    useFavoriteStore.getState().removeFavorite('place-1');

    expect(useFavoriteStore.getState().isFavorite('place-1')).toBe(false);
  });

  it('returns false after setFavorites([]) clears the list', () => {
    const fav = makeFavorite('place-1');
    useFavoriteStore.setState({ favorites: [fav] });

    useFavoriteStore.getState().setFavorites([]);

    expect(useFavoriteStore.getState().isFavorite('place-1')).toBe(false);
  });
});

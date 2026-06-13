/**
 * listCache saf yardımcıları (S15-P2) — stale-while-revalidate kararları.
 */
import {
  isCachedListUsable,
  shouldShowSkeleton,
  isListStale,
  LIST_STALE_MS,
} from '../../utils/listCache';

describe('isCachedListUsable', () => {
  it('dolu dizi → true', () => {
    expect(isCachedListUsable([{ placeId: 'a' }])).toBe(true);
  });
  it('boş dizi / dizi olmayan / null → false', () => {
    expect(isCachedListUsable([])).toBe(false);
    expect(isCachedListUsable(null)).toBe(false);
    expect(isCachedListUsable(undefined)).toBe(false);
    expect(isCachedListUsable('x')).toBe(false);
  });
});

describe('shouldShowSkeleton', () => {
  it('hidrasyon bitti + yükleniyor + liste boş → true', () => {
    expect(shouldShowSkeleton({ hasHydrated: true, loading: true, itemCount: 0 })).toBe(true);
  });
  it('cache varsa (itemCount>0) skeleton yok', () => {
    expect(shouldShowSkeleton({ hasHydrated: true, loading: true, itemCount: 5 })).toBe(false);
  });
  it('hidrasyon bitmeden skeleton yok (cache yanıp sönmesini önler)', () => {
    expect(shouldShowSkeleton({ hasHydrated: false, loading: true, itemCount: 0 })).toBe(false);
  });
  it('yüklenmiyorsa skeleton yok', () => {
    expect(shouldShowSkeleton({ hasHydrated: true, loading: false, itemCount: 0 })).toBe(false);
  });
});

describe('isListStale', () => {
  const now = 1_000_000_000;
  it('lastFetchedAt yoksa daima stale', () => {
    expect(isListStale(null, now)).toBe(true);
    expect(isListStale(undefined, now)).toBe(true);
    expect(isListStale(0, now)).toBe(true);
  });
  it('eşikten eski → stale', () => {
    expect(isListStale(now - LIST_STALE_MS - 1, now)).toBe(true);
  });
  it('eşik içinde → taze', () => {
    expect(isListStale(now - 1000, now)).toBe(false);
    expect(isListStale(now, now)).toBe(false);
  });
  it('özel maxAge parametresi', () => {
    expect(isListStale(now - 5000, now, 1000)).toBe(true);
    expect(isListStale(now - 500, now, 1000)).toBe(false);
  });
});

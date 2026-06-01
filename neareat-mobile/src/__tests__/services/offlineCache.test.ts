jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { saveCache, loadCache, isNetworkError } from '../../services/offlineCache';

describe('offlineCache', () => {
  it('saveCache → loadCache round-trip verisini döner', async () => {
    await saveCache('favorites', [{ id: '1', placeId: 'p1' }]);
    const data = await loadCache<any[]>('favorites');
    expect(data).toEqual([{ id: '1', placeId: 'p1' }]);
  });

  it('olmayan anahtar → null', async () => {
    const data = await loadCache('yok-boyle-anahtar');
    expect(data).toBeNull();
  });

  describe('isNetworkError', () => {
    it('sunucu yanıtı varsa (4xx/5xx) ağ hatası DEĞİL', () => {
      expect(isNetworkError({ response: { status: 500 } })).toBe(false);
    });

    it('yanıt yoksa (ağ/timeout) ağ hatası', () => {
      expect(isNetworkError({ message: 'Network Error' })).toBe(true);
      expect(isNetworkError({ code: 'ECONNABORTED' })).toBe(true);
    });

    it('null/undefined → false', () => {
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });
  });
});

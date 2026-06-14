/**
 * Optimistik favori toggle saf orkestrasyonu (Sprint-17 #368).
 */
import { runOptimisticFavoriteToggle } from '../../utils/optimisticFavorite';

describe('runOptimisticFavoriteToggle', () => {
  it('başarı yolunda optimistik durum korunur (add)', async () => {
    const states: boolean[] = [];
    const persist = jest.fn().mockResolvedValue(undefined);
    const ok = await runOptimisticFavoriteToggle({
      placeId: 'p1',
      currentlyFavorited: false,
      inFlight: new Set(),
      applyOptimistic: (f) => states.push(f),
      persist,
    });
    expect(ok).toBe(true);
    expect(persist).toHaveBeenCalledWith('add');
    expect(states).toEqual([true]); // sadece optimistik, rollback yok
  });

  it('hata yolunda önceki duruma rollback + onError', async () => {
    const states: boolean[] = [];
    const onError = jest.fn();
    await runOptimisticFavoriteToggle({
      placeId: 'p1',
      currentlyFavorited: true,
      inFlight: new Set(),
      applyOptimistic: (f) => states.push(f),
      persist: jest.fn().mockRejectedValue(new Error('net')),
      onError,
    });
    expect(states).toEqual([false, true]); // optimistik (false) → rollback (true)
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('remove aksiyonunu doğru gönderir', async () => {
    const persist = jest.fn().mockResolvedValue(undefined);
    await runOptimisticFavoriteToggle({
      placeId: 'p1', currentlyFavorited: true, inFlight: new Set(),
      applyOptimistic: () => {}, persist,
    });
    expect(persist).toHaveBeenCalledWith('remove');
  });

  it('çift tetikleme korumalı: işlem sürerken ikinci çağrı yoksayılır', async () => {
    const inFlight = new Set<string>();
    let resolveFirst: () => void = () => {};
    const persist = jest.fn().mockImplementationOnce(
      () => new Promise<void>((res) => { resolveFirst = res; }),
    );

    const first = runOptimisticFavoriteToggle({
      placeId: 'p1', currentlyFavorited: false, inFlight,
      applyOptimistic: () => {}, persist,
    });
    // İlk işlem devam ederken ikinci tetikleme
    const second = await runOptimisticFavoriteToggle({
      placeId: 'p1', currentlyFavorited: false, inFlight,
      applyOptimistic: () => {}, persist,
    });
    expect(second).toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);

    resolveFirst();
    await first;
    expect(inFlight.has('p1')).toBe(false); // işlem bitince küme temizlenir
  });
});

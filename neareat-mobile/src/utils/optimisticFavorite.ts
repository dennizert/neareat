/**
 * Optimistik favori toggle — saf orkestrasyon (Sprint-17 #368).
 *
 * UI'ı anında günceller (optimistik), sunucu çağrısı başarısız olursa eski duruma
 * döner. Çift tetiklemeyi (hızlı çift dokunma) `inFlight` kümesiyle engeller.
 * React/store'dan bağımsız — callback'lerle çalışır, jest ile test edilebilir.
 */

export type FavAction = 'add' | 'remove';

export interface OptimisticToggleArgs {
  placeId: string;
  /** Şu anki favori durumu (toggle bundan tersine döner). */
  currentlyFavorited: boolean;
  /** Devam eden toggle'ları tutan küme (çift tetikleme koruması). */
  inFlight: Set<string>;
  /** UI'ı verilen favori durumuna anında getirir (optimistik + rollback için). */
  applyOptimistic: (favorited: boolean) => void;
  /** Sunucu işlemi: 'add' → favoriye ekle, 'remove' → çıkar. */
  persist: (action: FavAction) => Promise<void>;
  /** Hata callback'i (ör. premium paywall yönlendirmesi / toast). */
  onError?: (err: unknown) => void;
}

/**
 * Favori durumunu optimistik olarak değiştirir.
 * @returns İşlemin uygulanıp uygulanmadığı (çift tetiklemede false).
 */
export async function runOptimisticFavoriteToggle(args: OptimisticToggleArgs): Promise<boolean> {
  const { placeId, currentlyFavorited, inFlight, applyOptimistic, persist, onError } = args;

  // Çift tetikleme koruması: aynı mekan için işlem sürüyorsa yoksay.
  if (inFlight.has(placeId)) return false;
  inFlight.add(placeId);

  const action: FavAction = currentlyFavorited ? 'remove' : 'add';
  applyOptimistic(!currentlyFavorited); // optimistik güncelleme

  try {
    await persist(action);
  } catch (err) {
    applyOptimistic(currentlyFavorited); // rollback
    onError?.(err);
  } finally {
    inFlight.delete(placeId);
  }
  return true;
}

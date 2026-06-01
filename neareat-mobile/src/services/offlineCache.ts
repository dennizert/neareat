/**
 * Çevrimdışı Önbellek Katmanı (S9-10 #172)
 *
 * Başarılı API yanıtlarını AsyncStorage'a yazar; ağ koptuğunda (sunucu yanıtı
 * yoksa) servisler bayat veriyi buradan döndürür. Böylece favoriler / keşif
 * listesi internet olmadan da gösterilebilir.
 *
 * Yalnızca AĞ hatalarında fallback yapılır (4xx/5xx gibi gerçek sunucu
 * hataları değil) — bkz. isNetworkError.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'offline-cache:';

/** Başarılı veriyi önbelleğe yazar (fire-and-forget; yazım hatası kritik değil). */
export async function saveCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {
    // cache yazımı başarısız olabilir — sessiz geç
  }
}

/** Önbellekteki veriyi döner, yoksa/bozuksa null. */
export async function loadCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && 'data' in parsed) ? (parsed.data as T) : null;
  } catch {
    return null;
  }
}

/**
 * Bir hatanın ağ/timeout kaynaklı olup olmadığını söyler.
 * Axios'ta sunucu yanıt verdiyse `error.response` dolu olur; yoksa ağ hatasıdır.
 */
export function isNetworkError(err: any): boolean {
  return !!err && !err.response;
}

/**
 * Konum Servisi
 *
 * Kullanıcının cihaz konumunu almak ve konum izni istemek için kullanılır.
 * Yakındaki restoranları listelemek için kullanıcı konumu gereklidir.
 * MOCK_MODE aktifken gerçek GPS kullanılmaz — sabit İstanbul koordinatları döner.
 */
import * as Location from 'expo-location';
import { MOCK_MODE, MOCK_COORDS } from '../config';

/** Koordinat arayüzü — enlem ve boylam çifti */
export interface Coords {
  lat: number;
  lng: number;
}

/**
 * Kullanıcıdan konum erişim izni ister.
 * iOS'ta ve Android'de sistem izin diyaloğu gösterilir.
 * Mock modda her zaman true döner — izin diyaloğu gösterilmez.
 *
 * Neden bu fonksiyon yazıldı:
 * Onboarding akışının ilk adımında konum izni istenir.
 * İzin verilmezse uygulama yakındaki restoranları listeleyemez.
 *
 * @returns İzin verildi mi
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (MOCK_MODE) return true;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Kullanıcının güncel konumunu alır.
 * Performans optimizasyonu olarak önce OS cache'indeki son bilinen konumu dener
 * (maxAge: 2 dakika). Bulunamazsa düşük doğrulukta (Low accuracy) GPS okuması yapar —
 * soğuk başlangıçta Balanced'dan çok daha hızlıdır.
 *
 * Neden bu fonksiyon yazıldı:
 * Backend'e yakındaki restoranları çekmek için kullanıcı koordinatları gönderilir.
 * Uygulama her açıldığında ve harita görünümünde konum güncellenir.
 *
 * @returns Kullanıcının mevcut koordinatları
 */
export async function getCurrentLocation(): Promise<Coords> {
  if (MOCK_MODE) return MOCK_COORDS;

  // Önce OS cache'inden son bilinen konumu kullan — anında döner
  const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
  if (last) {
    return { lat: last.coords.latitude, lng: last.coords.longitude };
  }

  // Cache'de konum yoksa düşük doğrulukta GPS oku (soğuk başlangıçta daha hızlı)
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Low,
  });
  return { lat: location.coords.latitude, lng: location.coords.longitude };
}

/** Konum + sahte konum bayrağı. `mocked` yalnızca Android'de anlamlı. */
export interface VerifiedCoords extends Coords {
  mocked: boolean;
}

/**
 * Check-in doğrulaması için konum okur.
 *
 * `getCurrentLocation`dan iki farkı var:
 * 1. `mocked` bayrağını korur — backend sahte konum sinyalini kaydediyor.
 * 2. Balanced doğruluk kullanır; keşif listesindeki ~kilometrelik hata burada
 *    kullanıcıyı 250 m yarıçapın dışına düşürüp hak kaybettirebilir.
 *
 * Konum alınamazsa `null` döner — çağıran check-in'i yine de yapabilir, sadece
 * ziyaret kanıtı sayılmaz.
 */
export async function getLocationForCheckin(): Promise<VerifiedCoords | null> {
  if (MOCK_MODE) return { ...MOCK_COORDS, mocked: false };
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      mocked: loc.mocked === true,
    };
  } catch {
    return null;
  }
}

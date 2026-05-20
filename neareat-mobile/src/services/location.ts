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

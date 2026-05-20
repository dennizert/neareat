/**
 * Dünya'nın yarıçapı (kilometre cinsinden).
 * Haversine formülünde iki koordinat arasındaki mesafeyi hesaplarken kullanılır.
 */
const R = 6371;

/**
 * İki coğrafi koordinat (enlem/boylam) arasındaki kuş uçuşu mesafeyi kilometre olarak hesaplar.
 * Haversine formülü kullanılır — Dünya'nın küresel şeklini dikkate alarak
 * düz düzlem yaklaşımlarından çok daha doğru sonuç verir.
 *
 * Neden bu fonksiyon yazıldı:
 * Kullanıcının konumuna en yakın restoranları sıralamak ve
 * restoran kartlarında mesafe bilgisini göstermek için gereklidir.
 *
 * @param lat1 - Birinci noktanın enlemi (derece)
 * @param lng1 - Birinci noktanın boylamı (derece)
 * @param lat2 - İkinci noktanın enlemi (derece)
 * @param lng2 - İkinci noktanın boylamı (derece)
 * @returns İki nokta arasındaki mesafe (kilometre)
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  /** Derece cinsinden açıyı radyana çevirir — trigonometrik fonksiyonlar radyan bekler */
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Kilometre cinsinden mesafeyi kullanıcı dostu formata dönüştürür.
 * 1 km'den küçük mesafeleri metre (m), büyük mesafeleri kilometre (km) olarak gösterir.
 *
 * Neden bu fonksiyon yazıldı:
 * Restoran kartlarında ve harita görünümünde mesafeyi okunabilir şekilde
 * göstermek için kullanılır (ör. "350 m" veya "2.4 km").
 *
 * @param km - Mesafe (kilometre cinsinden)
 * @returns Formatlanmış mesafe stringi (ör. "350 m" veya "2.4 km")
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

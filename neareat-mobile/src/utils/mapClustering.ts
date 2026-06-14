/**
 * Harita marker kümeleme (clustering) — saf yardımcılar (Sprint-17 #367).
 *
 * Yoğun bölgede üst üste binen pinleri, görünür harita bölgesini (region) bir
 * gride bölüp aynı hücreye düşen noktaları tek kümede toplayarak azaltır. React /
 * react-native-maps'ten bağımsız, deterministik ve jest ile test edilebilir.
 *
 * Zoom etkisi: region delta küçüldükçe (yakınlaşma) hücreler küçülür → daha az
 * nokta aynı hücreye düşer → kümeler tekil marker'lara çözülür.
 */

export interface ClusterPoint {
  placeId: string;
  lat: number;
  lng: number;
}

export interface Cluster<T extends ClusterPoint> {
  id: string;
  lat: number;       // küme merkezi (üyelerin ortalaması)
  lng: number;
  count: number;     // hücredeki nokta sayısı (1 → tekil marker)
  items: T[];
}

export interface MapRegion {
  latitudeDelta: number;
  longitudeDelta: number;
}

// Görünür bölgeyi kaç hücreye böleceğimiz (her eksen). Daha büyük = daha az kümeleme.
export const GRID_DIVISIONS = 8;

/**
 * Noktaları grid hücrelerine göre kümeler. Her hücre bir kümeye dönüşür; tek
 * noktalı hücreler `count: 1` ile tekil marker olarak işaretlenir.
 */
export function clusterPoints<T extends ClusterPoint>(
  points: T[],
  region: MapRegion,
  divisions: number = GRID_DIVISIONS,
): Cluster<T>[] {
  if (!points || points.length === 0) return [];

  const latStep = region ? region.latitudeDelta / divisions : 0;
  const lngStep = region ? region.longitudeDelta / divisions : 0;

  // Geçersiz/sıfır delta → kümeleme yapma, her noktayı tekil döndür.
  if (!(latStep > 0) || !(lngStep > 0)) {
    return points.map((p) => ({ id: p.placeId, lat: p.lat, lng: p.lng, count: 1, items: [p] }));
  }

  const cells = new Map<string, T[]>();
  for (const p of points) {
    const gx = Math.floor(p.lat / latStep);
    const gy = Math.floor(p.lng / lngStep);
    const key = `${gx}:${gy}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(p);
    else cells.set(key, [p]);
  }

  const clusters: Cluster<T>[] = [];
  for (const [key, items] of cells) {
    const sumLat = items.reduce((s, p) => s + p.lat, 0);
    const sumLng = items.reduce((s, p) => s + p.lng, 0);
    clusters.push({
      id: items.length === 1 ? items[0].placeId : `cluster-${key}`,
      lat: sumLat / items.length,
      lng: sumLng / items.length,
      count: items.length,
      items,
    });
  }
  return clusters;
}

/**
 * Bir kümeyi (üyelerini) kapsayan harita bölgesini hesaplar — kümeye dokununca
 * yakınlaşmak için. Üyelerin sınır kutusu + padding; çok küçük kümelerde minimum
 * delta uygulanır ki aşırı zoom olmasın.
 */
export function regionForCluster(
  items: ClusterPoint[],
  padding: number = 1.6,
  minDelta: number = 0.01,
): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null {
  if (!items || items.length === 0) return null;

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of items) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * padding, minDelta),
    longitudeDelta: Math.max((maxLng - minLng) * padding, minDelta),
  };
}

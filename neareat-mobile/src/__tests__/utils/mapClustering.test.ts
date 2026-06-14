/**
 * Harita kümeleme saf yardımcıları (Sprint-17 #367).
 */
import { clusterPoints, regionForCluster, type ClusterPoint } from '../../utils/mapClustering';

const p = (placeId: string, lat: number, lng: number): ClusterPoint => ({ placeId, lat, lng });

describe('clusterPoints', () => {
  it('boş giriş → boş çıktı', () => {
    expect(clusterPoints([], { latitudeDelta: 0.05, longitudeDelta: 0.05 })).toEqual([]);
  });

  it('tek nokta → tek tekil küme (count 1, id = placeId)', () => {
    const out = clusterPoints([p('a', 41, 29)], { latitudeDelta: 0.05, longitudeDelta: 0.05 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a', count: 1 });
  });

  it('çok yakın iki nokta tek kümede toplanır; uzak nokta ayrı kalır', () => {
    const pts = [p('a', 41.0000, 29.0000), p('b', 41.0005, 29.0005), p('c', 41.05, 29.05)];
    const clusters = clusterPoints(pts, { latitudeDelta: 0.08, longitudeDelta: 0.08 }, 8);
    // a & b aynı hücre (count 2), c ayrı (count 1)
    const counts = clusters.map((c) => c.count).sort();
    expect(counts).toEqual([1, 2]);
    const big = clusters.find((c) => c.count === 2)!;
    expect(big.items.map((i) => i.placeId).sort()).toEqual(['a', 'b']);
    // küme merkezi üyelerin ortalaması
    expect(big.lat).toBeCloseTo((41.0 + 41.0005) / 2);
  });

  it('zoom etkisi: dar delta (yakınlaşma) daha az kümeler', () => {
    const pts = [p('a', 41.000, 29.000), p('b', 41.004, 29.004)];
    const wide = clusterPoints(pts, { latitudeDelta: 0.2, longitudeDelta: 0.2 }, 8);
    const narrow = clusterPoints(pts, { latitudeDelta: 0.01, longitudeDelta: 0.01 }, 8);
    // geniş bölgede aynı hücre → 1 küme; dar bölgede ayrı → 2 tekil
    expect(wide).toHaveLength(1);
    expect(narrow).toHaveLength(2);
  });

  it('geçersiz/sıfır delta → her nokta tekil', () => {
    const pts = [p('a', 41, 29), p('b', 41.0001, 29.0001)];
    const out = clusterPoints(pts, { latitudeDelta: 0, longitudeDelta: 0 });
    expect(out).toHaveLength(2);
    expect(out.every((c) => c.count === 1)).toBe(true);
  });
});

describe('regionForCluster', () => {
  it('boş → null', () => {
    expect(regionForCluster([])).toBeNull();
  });

  it('üyelerin sınır kutusu merkez + minimum delta', () => {
    const r = regionForCluster([p('a', 41.0, 29.0), p('b', 41.02, 29.04)])!;
    expect(r.latitude).toBeCloseTo(41.01);
    expect(r.longitude).toBeCloseTo(29.02);
    expect(r.latitudeDelta).toBeGreaterThanOrEqual(0.01);
    expect(r.longitudeDelta).toBeGreaterThanOrEqual(0.01);
  });

  it('tek noktada minimum delta uygulanır (aşırı zoom önlenir)', () => {
    const r = regionForCluster([p('a', 41, 29)])!;
    expect(r.latitudeDelta).toBe(0.01);
    expect(r.longitudeDelta).toBe(0.01);
  });
});

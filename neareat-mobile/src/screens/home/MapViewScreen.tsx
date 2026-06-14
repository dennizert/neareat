import React, { useRef, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import type { Restaurant } from '../../types';
import { formatDistance } from '../../utils/haversine';
import { clusterPoints, regionForCluster, type ClusterPoint } from '../../utils/mapClustering';
import { runOptimisticFavoriteToggle } from '../../utils/optimisticFavorite';
import { useFavoriteStore } from '../../store/favoriteStore';
import { addFavoriteFromRestaurant, removeFavorite } from '../../services/favorites';
import { haptics } from '../../utils/haptics';
import AppIcon from '../../components/AppIcon';
import FadeInImage from '../../components/FadeInImage';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

interface Props {
  restaurants: Restaurant[];
  onPressRestaurant: (r: Restaurant) => void;
  userLat?: number;
  userLng?: number;
}

// Kümeleme için noktaya tüm restoran verisini de iliştiriyoruz (alt kart + tekil marker).
type RPoint = ClusterPoint & { r: Restaurant };

export default function MapViewScreen({ restaurants, onPressRestaurant, userLat, userLng }: Props) {
  const mapRef = useRef<MapView>(null);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  // Çift tetikleme koruması için devam eden favori işlemleri.
  const favInFlight = useRef<Set<string>>(new Set());

  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const isFavorite = useFavoriteStore((s) => s.isFavorite);
  const favorited = selected ? isFavorite(selected.placeId) : false;

  const centerLat = userLat ?? restaurants[0]?.location.lat;
  const centerLng = userLng ?? restaurants[0]?.location.lng;

  // Görünür bölge — kümeleme bunun delta'sına göre yapılır (zoom etkisi).
  const [region, setRegion] = useState<Region | undefined>(
    centerLat && centerLng
      ? { latitude: centerLat, longitude: centerLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
      : undefined,
  );

  const points: RPoint[] = useMemo(
    () => restaurants
      .filter((r) => r.location?.lat != null && r.location?.lng != null)
      .map((r) => ({ placeId: r.placeId, lat: r.location.lat, lng: r.location.lng, r })),
    [restaurants],
  );

  const clusters = useMemo(
    () => (region ? clusterPoints(points, region) : points.map((p) => ({ id: p.placeId, lat: p.lat, lng: p.lng, count: 1, items: [p] }))),
    [points, region],
  );

  if (!centerLat || !centerLng) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Haritada gösterilecek restoran yok.</Text>
      </View>
    );
  }

  // Kümeye dokun → üyelerini kapsayan bölgeye yumuşak zoom.
  function handleClusterPress(items: RPoint[]) {
    const target = regionForCluster(items);
    if (target) mapRef.current?.animateToRegion(target, 350);
  }

  // Tekil markera dokun → alt önizleme kartını aç + o mekana yaklaş.
  function handleSinglePress(r: Restaurant) {
    setSelected(r);
    mapRef.current?.animateToRegion(
      { latitude: r.location.lat, longitude: r.location.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      300,
    );
  }

  function handleRecenter() {
    mapRef.current?.animateToRegion(
      { latitude: centerLat, longitude: centerLng, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      400,
    );
  }

  // Alt karttaki hızlı favori — ortak optimistik util ile (anında tepki + rollback).
  function toggleFavorite(r: Restaurant) {
    haptics.light();
    const store = useFavoriteStore.getState();
    runOptimisticFavoriteToggle({
      placeId: r.placeId,
      currentlyFavorited: store.isFavorite(r.placeId),
      inFlight: favInFlight.current,
      applyOptimistic: (favorited) => {
        if (favorited) store.addFavorite(buildProvisional(r));
        else store.removeFavorite(r.placeId);
      },
      persist: async (action) => {
        if (action === 'remove') {
          await removeFavorite(r.placeId);
        } else {
          const created = await addFavoriteFromRestaurant(r);
          store.removeFavorite(r.placeId); // geçici kaydı gerçeğiyle değiştir
          store.addFavorite(created);
        }
      },
    });
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{ latitude: centerLat, longitude: centerLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        onRegionChangeComplete={setRegion}
        onPress={() => setSelected(null)}
      >
        {clusters.map((cluster) => {
          if (cluster.count > 1) {
            // Küme marker'ı — sayaç rozetli daire.
            return (
              <Marker
                key={cluster.id}
                coordinate={{ latitude: cluster.lat, longitude: cluster.lng }}
                onPress={() => handleClusterPress(cluster.items)}
                tracksViewChanges={false}
              >
                <View style={styles.cluster}>
                  <Text style={styles.clusterText}>{cluster.count}</Text>
                </View>
              </Marker>
            );
          }
          // Tekil marker.
          const r = cluster.items[0].r;
          const isSel = selected?.placeId === r.placeId;
          return (
            <Marker
              key={r.placeId}
              coordinate={{ latitude: r.location.lat, longitude: r.location.lng }}
              onPress={() => handleSinglePress(r)}
              tracksViewChanges={false}
            >
              <View style={styles.markerWrapper}>
                <View style={[styles.markerBubble, isSel && styles.markerBubbleSelected]}>
                  <Text style={styles.markerIcon}>{isSel ? '🍽️' : '🍴'}</Text>
                </View>
                <View style={styles.markerTail} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Konuma geri dön butonu */}
      <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter}>
        <Text style={styles.recenterText}>◎</Text>
      </TouchableOpacity>

      {/* Restoran sayısı rozeti */}
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{restaurants.length} restoran</Text>
      </View>

      {/* Alt önizleme kartı — dar Callout yerine net, kullanılabilir kart. */}
      {selected && (
        <View style={styles.previewCard}>
          {selected.photoUrl ? (
            <FadeInImage source={{ uri: selected.photoUrl }} style={styles.previewPhoto} />
          ) : (
            <View style={[styles.previewPhoto, styles.previewPhotoPlaceholder]}>
              <AppIcon name="restaurant" size={24} color={C.textMuted} />
            </View>
          )}
          <View style={styles.previewInfo}>
            <Text style={styles.previewName} numberOfLines={1}>{selected.name}</Text>
            <View style={styles.previewMeta}>
              <Text style={styles.previewRating}>★ {selected.rating?.toFixed(1)}</Text>
              <Text style={styles.previewDist}>· {formatDistance(selected.distanceKm)}</Text>
              {selected.isOpenNow != null && (
                <Text style={[styles.previewOpen, !selected.isOpenNow && styles.previewClosed]}>
                  · {selected.isOpenNow ? 'Açık' : 'Kapalı'}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.previewBtn} onPress={() => onPressRestaurant(selected)}>
              <Text style={styles.previewBtnText}>Detayı Gör →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.previewIconBtn}
              onPress={() => toggleFavorite(selected)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="heart" size={20} color={favorited ? C.error : C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.previewIconBtn}
              onPress={() => setSelected(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="close" size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// Optimistik favori için geçici kayıt (sunucu yanıtı gelene kadar).
function buildProvisional(r: Restaurant) {
  return {
    id: `temp-${r.placeId}`,
    placeId: r.placeId,
    placeName: r.name,
    placeAddress: r.formattedAddress ?? null,
    placeLat: r.location.lat,
    placeLng: r.location.lng,
    placePhone: null,
    placePhotoUrl: r.photoUrl ?? null,
    placeRating: r.rating ?? null,
  };
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },
    emptyText: { fontSize: 15, color: C.textTertiary },

    // Küme marker'ı
    cluster: {
      backgroundColor: C.primary,
      borderRadius: 22,
      minWidth: 40,
      height: 40,
      paddingHorizontal: 8,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2.5,
      borderColor: C.surface,
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 6,
    },
    clusterText: { color: '#fff', fontSize: 14, fontWeight: '800' },

    markerWrapper: { alignItems: 'center' },
    markerBubble: {
      backgroundColor: C.surface,
      borderRadius: 21,
      width: 38,
      height: 38,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2.5,
      borderColor: C.primary,
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
    },
    markerBubbleSelected: { backgroundColor: C.primary, transform: [{ scale: 1.15 }], borderColor: C.surface },
    markerIcon: { fontSize: 18 },
    markerTail: {
      width: 0, height: 0,
      borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9,
      borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.primary,
      marginTop: -1,
    },

    recenterBtn: {
      position: 'absolute', bottom: 24, right: 16,
      backgroundColor: C.surface, borderRadius: 28, width: 48, height: 48,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 5,
    },
    recenterText: { fontSize: 22, color: C.primary },

    countBadge: {
      position: 'absolute', top: 12, alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 5,
    },
    countText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Alt önizleme kartı
    previewCard: {
      position: 'absolute', bottom: 16, left: 12, right: 12,
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: 16, padding: 10, gap: 10,
      shadowColor: C.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8,
    },
    previewPhoto: { width: 72, height: 72, borderRadius: 12, backgroundColor: C.surfaceAlt },
    previewPhotoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    previewInfo: { flex: 1 },
    previewName: { fontSize: 15, fontWeight: '700', color: C.textPrimary, marginBottom: 3 },
    previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 7, flexWrap: 'wrap' },
    previewRating: { fontSize: 12.5, color: C.warning, fontWeight: '700' },
    previewDist: { fontSize: 12.5, color: C.textTertiary },
    previewOpen: { fontSize: 12.5, color: C.success, fontWeight: '600' },
    previewClosed: { color: C.error },
    previewBtn: { alignSelf: 'flex-start', backgroundColor: C.primary, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 6 },
    previewBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
    previewActions: { justifyContent: 'space-between', alignSelf: 'stretch', alignItems: 'center', paddingVertical: 2 },
    previewIconBtn: { padding: 4 },
  });
}

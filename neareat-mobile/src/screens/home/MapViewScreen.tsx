import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Restaurant } from '../../types';
import { formatDistance } from '../../utils/haversine';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

interface Props {
  restaurants: Restaurant[];
  onPressRestaurant: (r: Restaurant) => void;
  userLat?: number;
  userLng?: number;
}

export default function MapViewScreen({ restaurants, onPressRestaurant, userLat, userLng }: Props) {
  const mapRef = useRef<MapView>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const centerLat = userLat ?? restaurants[0]?.location.lat;
  const centerLng = userLng ?? restaurants[0]?.location.lng;

  if (!centerLat || !centerLng) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Haritada gösterilecek restoran yok.</Text>
      </View>
    );
  }

  function handleMarkerPress(r: Restaurant) {
    setSelectedId(r.placeId);
    mapRef.current?.animateToRegion(
      {
        latitude: r.location.lat,
        longitude: r.location.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      350,
    );
  }

  function handleRecenter() {
    mapRef.current?.animateToRegion(
      {
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      400,
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {restaurants.map((r) => {
          const isSelected = r.placeId === selectedId;
          return (
            <Marker
              key={r.placeId}
              coordinate={{ latitude: r.location.lat, longitude: r.location.lng }}
              onPress={() => handleMarkerPress(r)}
            >
              <View style={styles.markerWrapper}>
                <View style={[styles.markerBubble, isSelected && styles.markerBubbleSelected]}>
                  <Text style={styles.markerIcon}>{isSelected ? '🍽️' : '🍴'}</Text>
                </View>
                <View style={[styles.markerTail, isSelected && styles.markerTailSelected]} />
              </View>
              <Callout onPress={() => onPressRestaurant(r)} tooltip={false}>
                <View style={styles.callout}>
                  <Text style={styles.calloutName} numberOfLines={2}>{r.name}</Text>
                  <View style={styles.calloutMeta}>
                    <Text style={styles.calloutRating}>★ {r.rating?.toFixed(1)}</Text>
                    {r.isOpenNow !== null && (
                      <Text style={[styles.calloutOpen, !r.isOpenNow && styles.calloutClosed]}>
                        {r.isOpenNow ? '  Açık' : '  Kapalı'}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.calloutDist}>{formatDistance(r.distanceKm)}</Text>
                  <TouchableOpacity style={styles.calloutBtn} onPress={() => onPressRestaurant(r)}>
                    <Text style={styles.calloutBtnText}>Detayı Gör →</Text>
                  </TouchableOpacity>
                </View>
              </Callout>
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
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },
    emptyText: { fontSize: 15, color: C.textTertiary },

    markerWrapper: { alignItems: 'center' },
    markerBubble: {
      backgroundColor: C.surface,
      borderRadius: 24,
      width: 42,
      height: 42,
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
    markerBubbleSelected: {
      backgroundColor: C.primary,
      transform: [{ scale: 1.15 }],
      borderColor: C.surface,
    },
    markerIcon: { fontSize: 20 },
    markerTail: {
      width: 0,
      height: 0,
      borderLeftWidth: 7,
      borderRightWidth: 7,
      borderTopWidth: 10,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: C.primary,
      marginTop: -1,
    },
    markerTailSelected: { borderTopColor: C.primary },

    callout: { width: 200, padding: 10 },
    calloutName: { fontWeight: '700', fontSize: 14, color: C.textPrimary, marginBottom: 4 },
    calloutMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    calloutRating: { fontSize: 13, color: C.warning, fontWeight: '600' },
    calloutOpen: { fontSize: 12, color: C.success, fontWeight: '500' },
    calloutClosed: { color: C.error },
    calloutDist: { fontSize: 12, color: C.textTertiary, marginBottom: 8 },
    calloutBtn: { backgroundColor: C.primary, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
    calloutBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    recenterBtn: {
      position: 'absolute',
      bottom: 24,
      right: 16,
      backgroundColor: C.surface,
      borderRadius: 28,
      width: 48,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 5,
    },
    recenterText: { fontSize: 22, color: C.primary },

    countBadge: {
      position: 'absolute',
      top: 12,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 5,
    },
    countText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  });
}

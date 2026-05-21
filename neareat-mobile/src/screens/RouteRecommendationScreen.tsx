/**
 * RouteRecommendationScreen — "Yolda ne yesem?" ekranı (Sprint-3 Task #8).
 *
 * Kullanıcı çıkış ve varış noktasını il/ilçe autocomplete ile seçer,
 * opsiyonel yola çıkış zamanı girer, "Rotamı Öner" ile rota boyunca
 * en iyi durakları getirir. GPS gerekmiyor.
 * Sprint-4: Harita görselleştirmesi + Google Maps / Waze navigasyon.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Animated, Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { useAiRecommendationStore } from '../store/aiRecommendationStore';
import PlaceSearchInput from '../components/PlaceSearchInput';
import RecommendationCard from '../components/RecommendationCard';
import { useTheme } from '../theme';
import type { Colors } from '../theme';
import type { TurkishPlace } from '../data/turkishPlaces';
import type { AiRecommendation, RouteRecommendation } from '../types';

const DAY_LABELS = ['Bugün', 'Yarın', 'Öbür gün'];
const MAX_SLOT = 47;

function slotToHHMM(slot: number): string {
  const h = Math.floor(slot / 2);
  const m = slot % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
}

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

function openNavigation(lat: number, lng: number, _name: string) {
  Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
  );
}

export default function RouteRecommendationScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const {
    routeRecommendations,
    routeMeta,
    routeNoteToUser,
    routeLoading,
    routeError,
    routeLimitReached,
    routeNoCandidates,
    fetchRouteRecommendation,
    resetRoute,
  } = useAiRecommendationStore();

  const [origin, setOrigin] = useState<TurkishPlace | null>(null);
  const [destination, setDestination] = useState<TurkishPlace | null>(null);
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Departure time picker
  const [depDayOffset, setDepDayOffset] = useState(0);
  const [depSlot, setDepSlot] = useState(() => {
    const localMs = Date.now() + ISTANBUL_OFFSET_MS;
    const d = new Date(localMs);
    return Math.min(d.getUTCHours() * 2 + (d.getUTCMinutes() >= 30 ? 1 : 0) + 1, MAX_SLOT);
  });

  const departureTimeISO = useMemo(() => {
    const localMs = Date.now() + ISTANBUL_OFFSET_MS;
    const d = new Date(localMs);
    d.setUTCHours(0, 0, 0, 0);
    const midnightLocalMs = d.getTime() + depDayOffset * 24 * 60 * 60 * 1000;
    const slotMs = Math.floor(depSlot / 2) * 3_600_000 + (depSlot % 2) * 1_800_000;
    return new Date(midnightLocalMs + slotMs - ISTANBUL_OFFSET_MS).toISOString();
  }, [depDayOffset, depSlot]);

  const prevLimitRef = useRef(false);
  useEffect(() => {
    if (routeLimitReached && !prevLimitRef.current) {
      navigation.navigate('PremiumUpsell', {});
    }
    prevLimitRef.current = routeLimitReached;
  }, [routeLimitReached, navigation]);

  useEffect(() => () => { resetRoute(); }, []);

  // Hide map when results are reset
  useEffect(() => {
    if (routeRecommendations.length === 0) setShowMap(false);
  }, [routeRecommendations.length]);

  const handleFetch = useCallback(async () => {
    if (!origin || !destination) return;
    await fetchRouteRecommendation({
      originLat: origin.lat,
      originLng: origin.lng,
      destLat: destination.lat,
      destLng: destination.lng,
      departureTime: departureTimeISO,
    });
  }, [origin, destination, departureTimeISO, fetchRouteRecommendation]);

  const canFetch = !!origin && !!destination;
  const hasResults = routeRecommendations.length > 0;

  // Map coordinates: origin → stops (in order) → destination
  const mapCoords = useMemo(() => {
    if (!origin || !destination) return [];
    const stops = routeRecommendations
      .filter((r) => r.restaurant.location)
      .map((r) => ({
        latitude: r.restaurant.location!.lat,
        longitude: r.restaurant.location!.lng,
      }));
    return [
      { latitude: origin.lat, longitude: origin.lng },
      ...stops,
      { latitude: destination.lat, longitude: destination.lng },
    ];
  }, [origin, destination, routeRecommendations]);

  function handleMapReady() {
    if (mapCoords.length >= 2) {
      mapRef.current?.fitToCoordinates(mapCoords, {
        edgePadding: { top: 60, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Yolda ne yesem?</Text>
      <Text style={styles.subtitle}>Rotana göre en iyi yemek duraklarını bul</Text>

      {/* Konum girişleri */}
      <View style={styles.routeInputs}>
        <PlaceSearchInput
          label="Çıkış Noktası"
          value={origin}
          onChange={setOrigin}
          placeholder="Nereden? (ör. Ankara, Çankaya...)"
        />
        <View style={styles.routeArrow}>
          <Text style={styles.routeArrowText}>↓</Text>
        </View>
        <PlaceSearchInput
          label="Varış Noktası"
          value={destination}
          onChange={setDestination}
          placeholder="Nereye? (ör. İstanbul, Kadıköy...)"
        />
      </View>

      {/* Yola çıkış zamanı */}
      <View style={styles.depSection}>
        <Text style={styles.sectionLabel}>YOL ÇIKIŞ ZAMANI</Text>

        <View style={styles.depRow}>
          <Text style={styles.depRowLabel}>Gün</Text>
          <View style={styles.depStepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setDepDayOffset((d) => Math.max(0, d - 1))}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>◀</Text>
            </TouchableOpacity>
            <Text style={styles.depValue}>{DAY_LABELS[depDayOffset]}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setDepDayOffset((d) => Math.min(2, d + 1))}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>▶</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.depRow}>
          <Text style={styles.depRowLabel}>Saat</Text>
          <View style={styles.depStepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setDepSlot((s) => (s === 0 ? MAX_SLOT : s - 1))}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>◀</Text>
            </TouchableOpacity>
            <Text style={styles.depValue}>{slotToHHMM(depSlot)}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setDepSlot((s) => (s === MAX_SLOT ? 0 : s + 1))}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>▶</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Ana CTA */}
      <TouchableOpacity
        style={[styles.cta, (!canFetch || routeLoading) && styles.ctaDisabled]}
        onPress={handleFetch}
        disabled={!canFetch || routeLoading}
        activeOpacity={0.85}
      >
        {routeLoading ? (
          <>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.ctaText}>Rota önerileri hazırlanıyor…</Text>
          </>
        ) : (
          <Text style={styles.ctaText}>
            {hasResults ? '🔄 Tekrar öner' : '🗺️  Rotamı Öner'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Rota özeti + harita toggle */}
      {routeMeta && hasResults && (
        <View style={styles.routeSummaryRow}>
          <Text style={styles.routeSummaryText}>
            ~{routeMeta.totalDistanceKm} km  ·  ~{routeMeta.totalDurationMin} dk
          </Text>
          <TouchableOpacity
            style={styles.mapToggleBtn}
            onPress={() => setShowMap((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.mapToggleBtnText}>
              {showMap ? '🗺️ Gizle' : '🗺️ Haritada gör'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Harita */}
      {hasResults && showMap && mapCoords.length >= 2 && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            onMapReady={handleMapReady}
            initialRegion={{
              latitude: (origin!.lat + destination!.lat) / 2,
              longitude: (origin!.lng + destination!.lng) / 2,
              latitudeDelta: Math.abs(origin!.lat - destination!.lat) * 1.8 + 0.05,
              longitudeDelta: Math.abs(origin!.lng - destination!.lng) * 1.8 + 0.05,
            }}
          >
            {/* Rota çizgisi */}
            <Polyline
              coordinates={mapCoords}
              strokeColor={C.primary}
              strokeWidth={3}
              lineDashPattern={[8, 4]}
            />

            {/* Çıkış noktası */}
            <Marker coordinate={{ latitude: origin!.lat, longitude: origin!.lng }} anchor={{ x: 0.5, y: 1 }}>
              <View style={styles.pinOrigin}>
                <Text style={styles.pinLabel}>Çıkış</Text>
              </View>
            </Marker>

            {/* Varış noktası */}
            <Marker coordinate={{ latitude: destination!.lat, longitude: destination!.lng }} anchor={{ x: 0.5, y: 1 }}>
              <View style={styles.pinDest}>
                <Text style={styles.pinLabel}>Varış</Text>
              </View>
            </Marker>

            {/* Restoran durakları */}
            {routeRecommendations.map((rec) => {
              if (!rec.restaurant.location) return null;
              return (
                <Marker
                  key={rec.placeId}
                  coordinate={{
                    latitude: rec.restaurant.location.lat,
                    longitude: rec.restaurant.location.lng,
                  }}
                  anchor={{ x: 0.5, y: 1 }}
                  onPress={() => openNavigation(
                    rec.restaurant.location!.lat,
                    rec.restaurant.location!.lng,
                    rec.restaurant.name
                  )}
                >
                  <View style={styles.pinStop}>
                    <Text style={styles.pinStopText}>{rec.restaurant.sequenceOrder}</Text>
                  </View>
                </Marker>
              );
            })}
          </MapView>
          <View style={styles.mapLegend}>
            <Text style={styles.mapLegendText}>Durak numarasına tıkla → yol tarifi al</Text>
          </View>
        </View>
      )}

      {/* Hata: limit doldu */}
      {routeLimitReached && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⏰</Text>
          <Text style={styles.errorTitle}>Günlük hakkın doldu</Text>
          <Text style={styles.errorText}>
            {routeError || 'Bu gün için 3 AI öneri hakkını kullandın.'}
          </Text>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => navigation.navigate('PremiumUpsell', {})}
            activeOpacity={0.85}
          >
            <Text style={styles.upgradeBtnText}>✨ Premium'a Geç</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Hata: aday/rota yok */}
      {routeNoCandidates && !routeLimitReached && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>📍</Text>
          <Text style={styles.errorTitle}>Uygun yer bulunamadı</Text>
          <Text style={styles.errorText}>
            {routeError || 'Rota boyunca uygun restoran bulamadık.'}
          </Text>
        </View>
      )}

      {/* Hata: generic */}
      {routeError && !routeLimitReached && !routeNoCandidates && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Bir sorun oluştu</Text>
          <Text style={styles.errorText}>{routeError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleFetch} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LLM notu */}
      {routeNoteToUser && hasResults && (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>💬 {routeNoteToUser}</Text>
        </View>
      )}

      {/* Sonuç kartları */}
      {hasResults && (
        <View style={styles.resultsSection}>
          {routeRecommendations.map((rec) => (
            <FadeInCard key={rec.placeId}>
              {/* Stop header */}
              <View style={styles.stopHeader}>
                <Text style={styles.stopLabelText}>{rec.restaurant.sequenceOrder}. Durak</Text>
                <View style={styles.stopMeta}>
                  {rec.restaurant.detourKm != null && (
                    <Text style={styles.detourText}>+{rec.restaurant.detourKm} km sapma</Text>
                  )}
                  {rec.restaurant.openAtArrival != null && (
                    <Text style={[
                      styles.openAtText,
                      rec.restaurant.openAtArrival ? styles.openAtOpen : styles.openAtClosed,
                    ]}>
                      {rec.restaurant.openAtArrival ? '✓ Varışta açık' : '⚠ Varışta kapalı olabilir'}
                    </Text>
                  )}
                </View>
              </View>

              <RecommendationCard
                recommendation={rec as unknown as AiRecommendation}
                index={rec.restaurant.sequenceOrder}
                onPressDetails={(placeId) =>
                  navigation.navigate('RestaurantDetail', { placeId })
                }
              />

              {/* Navigasyon butonu */}
              {rec.restaurant.location && (
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => openNavigation(
                    rec.restaurant.location!.lat,
                    rec.restaurant.location!.lng,
                    rec.restaurant.name
                  )}
                  activeOpacity={0.8}
                >
                  <Text style={styles.navBtnText}>🧭 Yol Tarifi Al</Text>
                </TouchableOpacity>
              )}
            </FadeInCard>
          ))}
        </View>
      )}

      {/* Boş durum */}
      {!hasResults && !routeLoading && !routeError && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyText}>
            Çıkış ve varış noktalarını seç, rotandaki en iyi yemek duraklarını bul
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function FadeInCard({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { padding: 16, paddingBottom: 40 },

    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, marginBottom: 4 },
    subtitle: { fontSize: 14, color: C.textTertiary, marginBottom: 20 },

    routeInputs: { marginBottom: 4 },
    routeArrow: { alignItems: 'center', marginVertical: 2 },
    routeArrowText: { fontSize: 20, color: C.textMuted },

    depSection: { marginTop: 16, marginBottom: 18 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: C.textTertiary,
      letterSpacing: 0.5, marginBottom: 10,
    },
    depRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 10,
    },
    depRowLabel: { fontSize: 14, fontWeight: '600', color: C.textSecondary, width: 48 },
    depStepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    stepBtnText: { fontSize: 13, color: C.primary, fontWeight: '700' },
    depValue: { fontSize: 15, fontWeight: '700', color: C.textPrimary, minWidth: 72, textAlign: 'center' },

    cta: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
      backgroundColor: C.primary, paddingVertical: 14, borderRadius: 14,
      marginBottom: 12,
      shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    ctaDisabled: { opacity: 0.5 },
    ctaText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    routeSummaryRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 10, marginBottom: 8,
    },
    routeSummaryText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
    mapToggleBtn: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
      backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
    },
    mapToggleBtnText: { fontSize: 12, fontWeight: '700', color: C.primary },

    mapContainer: {
      borderRadius: 14, overflow: 'hidden', marginBottom: 12,
      borderWidth: 1, borderColor: C.border,
    },
    map: { height: 260, width: '100%' },
    mapLegend: {
      backgroundColor: C.surface, padding: 8, alignItems: 'center',
    },
    mapLegendText: { fontSize: 11, color: C.textMuted },

    // Map pins
    pinOrigin: {
      backgroundColor: '#16a34a', paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 12, borderWidth: 2, borderColor: '#fff',
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, elevation: 4,
    },
    pinDest: {
      backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 12, borderWidth: 2, borderColor: '#fff',
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, elevation: 4,
    },
    pinLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
    pinStop: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: C.primary, borderWidth: 2, borderColor: '#fff',
      justifyContent: 'center', alignItems: 'center',
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, elevation: 4,
    },
    pinStopText: { color: '#fff', fontSize: 13, fontWeight: '800' },

    errorBox: {
      backgroundColor: C.surface, borderRadius: 14, padding: 20,
      alignItems: 'center', marginBottom: 16,
      borderWidth: 1, borderColor: C.border,
    },
    errorIcon: { fontSize: 36, marginBottom: 8 },
    errorTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
    errorText: { fontSize: 13, color: C.textTertiary, textAlign: 'center', marginBottom: 8 },
    upgradeBtn: {
      backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    },
    upgradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    retryBtn: {
      paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
      borderWidth: 1.5, borderColor: C.primary,
    },
    retryBtnText: { color: C.primary, fontWeight: '700', fontSize: 14 },

    noteBox: {
      backgroundColor: C.surfaceAlt, borderRadius: 12, padding: 12, marginBottom: 16,
    },
    noteText: { fontSize: 13, color: C.textSecondary, fontStyle: 'italic', lineHeight: 19 },

    resultsSection: { marginTop: 4 },
    stopHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 12, marginBottom: 4,
    },
    stopLabelText: {
      fontSize: 12, fontWeight: '700', color: C.primary,
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    stopMeta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    detourText: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
    openAtText: { fontSize: 11, fontWeight: '700' },
    openAtOpen: { color: '#16a34a' },
    openAtClosed: { color: '#dc2626' },

    navBtn: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
      backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.primary,
      borderRadius: 12, paddingVertical: 10, marginTop: 2, marginBottom: 4,
    },
    navBtnText: { fontSize: 14, fontWeight: '700', color: C.primary },

    emptyState: { paddingVertical: 40, alignItems: 'center' },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  });
}

/**
 * RouteRecommendationScreen — "Yolda ne yesem?" ekranı (Sprint-3 Task #8).
 *
 * Kullanıcı konum alır, preset hedef seçer, mood seçer (opsiyonel),
 * "Rotamı Öner" ile rota boyunca en iyi durakları getirir.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAiRecommendationStore } from '../store/aiRecommendationStore';
import { getCurrentLocation } from '../services/location';
import RecommendationCard from '../components/RecommendationCard';
import { useTheme } from '../theme';
import type { Colors } from '../theme';
import type { AiRecommendation } from '../types';

const PRESET_DESTINATIONS = [
  { key: 'kadikoy',  label: 'Kadıköy',    lat: 40.9919, lng: 29.0226 },
  { key: 'airport',  label: 'Havalimanı', lat: 41.2753, lng: 28.7519 },
  { key: 'sisli',    label: 'Şişli',      lat: 41.0602, lng: 28.9870 },
];

const MOOD_OPTIONS = [
  { key: 'hızlı',         label: 'Hızlı',    emoji: '⚡' },
  { key: 'şık',           label: 'Şık',      emoji: '✨' },
  { key: 'romantik',      label: 'Romantik', emoji: '🌹' },
  { key: 'aile',          label: 'Aile',     emoji: '👨‍👩‍👧' },
  { key: 'sağlıklı',      label: 'Sağlıklı', emoji: '🥗' },
  { key: 'uygun fiyatlı', label: 'Bütçeli',  emoji: '💰' },
];

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

  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);

  const prevLimitRef = useRef(false);
  useEffect(() => {
    if (routeLimitReached && !prevLimitRef.current) {
      navigation.navigate('PremiumUpsell', {});
    }
    prevLimitRef.current = routeLimitReached;
  }, [routeLimitReached, navigation]);

  useEffect(() => () => { resetRoute(); }, []);

  const handleFetch = useCallback(async () => {
    if (!selectedDest) return;
    const dest = PRESET_DESTINATIONS.find((d) => d.key === selectedDest);
    if (!dest) return;

    setLocating(true);
    let coords = originCoords;
    try {
      if (!coords) {
        coords = await getCurrentLocation();
        setOriginCoords(coords);
      }
    } catch {
      setLocating(false);
      return;
    }
    setLocating(false);

    await fetchRouteRecommendation({
      originLat: coords.lat,
      originLng: coords.lng,
      destLat: dest.lat,
      destLng: dest.lng,
      mood: selectedMood ?? undefined,
    });
  }, [selectedDest, selectedMood, originCoords, fetchRouteRecommendation]);

  const isBusy = locating || routeLoading;
  const hasResults = routeRecommendations.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Yolda ne yesem?</Text>
      <Text style={styles.subtitle}>Rotana göre en iyi durakları bul</Text>

      {/* Hedef seçici */}
      <Text style={styles.sectionLabel}>HEDEF</Text>
      <View style={styles.destRow}>
        {PRESET_DESTINATIONS.map((d) => (
          <TouchableOpacity
            key={d.key}
            style={[styles.destChip, selectedDest === d.key && styles.destChipActive]}
            onPress={() => setSelectedDest(d.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.destLabel, selectedDest === d.key && styles.destLabelActive]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Mood seçici */}
      <View style={styles.moodSection}>
        <Text style={styles.sectionLabel}>RUH HALİ (OPSİYONEL)</Text>
        <View style={styles.moodGrid}>
          {MOOD_OPTIONS.map((m) => {
            const active = selectedMood === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.moodChip, active && styles.moodChipActive]}
                onPress={() => setSelectedMood(active ? null : m.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Ana CTA */}
      <TouchableOpacity
        style={[styles.cta, (isBusy || !selectedDest) && styles.ctaDisabled]}
        onPress={handleFetch}
        disabled={isBusy || !selectedDest}
        activeOpacity={0.85}
      >
        {isBusy ? (
          <>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.ctaText}>
              {locating ? 'Konum alınıyor…' : 'Rota önerileri hazırlanıyor…'}
            </Text>
          </>
        ) : (
          <Text style={styles.ctaText}>
            {hasResults ? '🔄 Tekrar öner' : '🗺️  Rotamı Öner'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Rota özeti */}
      {routeMeta && hasResults && (
        <View style={styles.routeSummary}>
          <Text style={styles.routeSummaryText}>
            ~{routeMeta.totalDistanceKm} km  ·  ~{routeMeta.totalDurationMin} dk
          </Text>
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
              <View style={styles.stopLabel}>
                <Text style={styles.stopLabelText}>{rec.restaurant.sequenceOrder}. Durak</Text>
              </View>
              <RecommendationCard
                recommendation={rec as unknown as AiRecommendation}
                index={rec.restaurant.sequenceOrder}
                onPressDetails={(placeId) =>
                  navigation.navigate('RestaurantDetail', { placeId })
                }
              />
            </FadeInCard>
          ))}
        </View>
      )}

      {/* Boş durum */}
      {!hasResults && !routeLoading && !routeError && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyText}>
            Hedefinizi seç ve rotandaki en iyi yemek duraklarını bul
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
    content: { padding: 16, paddingBottom: 32 },

    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, marginBottom: 4 },
    subtitle: { fontSize: 14, color: C.textTertiary, marginBottom: 16 },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: C.textTertiary,
      letterSpacing: 0.5, marginBottom: 10,
    },

    destRow: { flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
    destChip: {
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
      backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
    },
    destChipActive: { backgroundColor: C.primarySurface, borderColor: C.primary },
    destLabel: { fontSize: 14, fontWeight: '600', color: C.textSecondary },
    destLabelActive: { color: C.primary, fontWeight: '700' },

    moodSection: { marginBottom: 18 },
    moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    moodChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
    },
    moodChipActive: { backgroundColor: C.primarySurface, borderColor: C.primary },
    moodEmoji: { fontSize: 14 },
    moodLabel: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
    moodLabelActive: { color: C.primary, fontWeight: '700' },

    cta: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
      backgroundColor: C.primary, paddingVertical: 14, borderRadius: 14,
      marginBottom: 12,
      shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    ctaDisabled: { opacity: 0.5 },
    ctaText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    routeSummary: {
      backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 10,
      alignItems: 'center', marginBottom: 16,
    },
    routeSummaryText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },

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
    stopLabel: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4 },
    stopLabelText: {
      fontSize: 12, fontWeight: '700', color: C.primary,
      textTransform: 'uppercase', letterSpacing: 0.5,
    },

    emptyState: { paddingVertical: 40, alignItems: 'center' },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  });
}

/**
 * RecommendationScreen — "Bu akşam ne yesem?" ana ekranı (Sprint-1 Task #8).
 *
 * Akış:
 *   1. Mood seçici (opsiyonel) — hızlı / şık / romantik / aile + serbest
 *   2. "Önerileri Getir" butonu → konum al → store.fetchDinnerRecommendation
 *   3. Loading: skeleton (4 placeholder kart)
 *   4. Sonuç: 1-3 RecommendationCard + opsiyonel noteToUser
 *   5. Hata:
 *      - limitReached → inline banner (Task #10'da PremiumUpsell ekranına yönlenecek)
 *      - noCandidates → "uzaklaş" mesajı
 *      - generic → tekrar dene butonu
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAiRecommendationStore } from '../store/aiRecommendationStore';
import { getCurrentLocation } from '../services/location';
import RecommendationCard from '../components/RecommendationCard';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

const MOOD_OPTIONS: Array<{ key: string; label: string; emoji: string }> = [
  { key: 'hızlı',     label: 'Hızlı',     emoji: '⚡' },
  { key: 'şık',       label: 'Şık',       emoji: '✨' },
  { key: 'romantik',  label: 'Romantik',  emoji: '🌹' },
  { key: 'aile',      label: 'Aile',      emoji: '👨‍👩‍👧' },
  { key: 'sağlıklı',  label: 'Sağlıklı',  emoji: '🥗' },
  { key: 'uygun fiyatlı', label: 'Bütçeli', emoji: '💰' },
];

export default function RecommendationScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const {
    loading,
    recommendations,
    noteToUser,
    tier,
    remainingToday,
    resetAt,
    error,
    limitReached,
    noCandidates,
    fetchDinnerRecommendation,
  } = useAiRecommendationStore();

  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Auto-navigate to PremiumUpsell on 429 transition (Sprint-1 Task #10).
  // useRef ile transition'ı tespit ediyoruz — sadece false→true geçişinde push,
  // ekran focus geri geldiğinde tekrar push olmasın diye.
  const prevLimitReachedRef = useRef(false);
  useEffect(() => {
    if (limitReached && !prevLimitReachedRef.current) {
      navigation.navigate('PremiumUpsell', { resetAt: resetAt ?? undefined });
    }
    prevLimitReachedRef.current = limitReached;
  }, [limitReached, resetAt, navigation]);

  const handleFetch = useCallback(async () => {
    setLocating(true);
    try {
      const coords = await getCurrentLocation();
      setLocating(false);
      await fetchDinnerRecommendation(coords.lat, coords.lng, selectedMood ?? undefined);
    } catch (err) {
      setLocating(false);
    }
  }, [fetchDinnerRecommendation, selectedMood]);

  const handleDetails = useCallback((placeId: string) => {
    navigation.navigate('RestaurantDetail', { placeId });
  }, [navigation]);

  const isBusy = locating || loading;
  const hasResults = recommendations.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isBusy} onRefresh={handleFetch} tintColor={C.primary} />
      }
    >
      {/* Başlık */}
      <Text style={styles.title}>Bu akşam ne yesem?</Text>
      <Text style={styles.subtitle}>
        Geçmişine ve tercihlerine göre kişisel öneri al
      </Text>

      {/* Tier rozeti — sonuç geldikten sonra göster */}
      {tier && (
        <View style={styles.tierRow}>
          <View style={[styles.tierBadge, tier === 'premium' && styles.tierBadgePremium]}>
            <Text style={[styles.tierBadgeText, tier === 'premium' && styles.tierBadgeTextPremium]}>
              {tier === 'premium' ? '✨ Premium' : 'Ücretsiz'}
            </Text>
          </View>
          {tier === 'free' && remainingToday != null && (
            <Text style={styles.remaining}>
              Bugün kalan hak: <Text style={styles.remainingNumber}>{remainingToday}/3</Text>
            </Text>
          )}
        </View>
      )}

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
        style={[styles.cta, isBusy && styles.ctaDisabled]}
        onPress={handleFetch}
        disabled={isBusy}
        activeOpacity={0.85}
      >
        {isBusy ? (
          <>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.ctaText}>
              {locating ? 'Konum alınıyor…' : 'Öneriler hazırlanıyor…'}
            </Text>
          </>
        ) : (
          <Text style={styles.ctaText}>
            {hasResults ? '🔄 Yeni öneri al' : '🍽️  Önerileri Getir'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Hata: limit doldu */}
      {limitReached && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⏰</Text>
          <Text style={styles.errorTitle}>Günlük hakkın doldu</Text>
          <Text style={styles.errorText}>
            {error || 'Bu gün için 3 AI öneri hakkını kullandın.'}
          </Text>
          {resetAt && (
            <Text style={styles.resetText}>
              Yenileme: {formatResetTime(resetAt)}
            </Text>
          )}
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => navigation.navigate('PremiumUpsell', { resetAt: resetAt ?? undefined })}
            activeOpacity={0.85}
          >
            <Text style={styles.upgradeBtnText}>✨ Premium'a Geç</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Hata: aday yok */}
      {noCandidates && !limitReached && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>📍</Text>
          <Text style={styles.errorTitle}>Yakında uygun restoran yok</Text>
          <Text style={styles.errorText}>
            {error || 'Konumunu güncelle veya biraz uzaklaş.'}
          </Text>
        </View>
      )}

      {/* Hata: generic */}
      {error && !limitReached && !noCandidates && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Bir sorun oluştu</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleFetch} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LLM ekstra notu */}
      {noteToUser && hasResults && (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>💬 {noteToUser}</Text>
        </View>
      )}

      {/* Sonuç kartları */}
      {hasResults && (
        <View style={styles.resultsSection}>
          {recommendations.map((rec, i) => (
            <RecommendationCard
              key={rec.placeId}
              recommendation={rec}
              index={i + 1}
              onPressDetails={handleDetails}
            />
          ))}
        </View>
      )}

      {/* Empty state — hiç sorgu yapılmadıysa */}
      {!hasResults && !loading && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🤔</Text>
          <Text style={styles.emptyText}>
            Mood'unu seç (veya boş bırak) ve önerileri getir
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function formatResetTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul',
    });
  } catch {
    return '';
  }
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { padding: 16, paddingBottom: 32 },

    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, marginBottom: 4 },
    subtitle: { fontSize: 14, color: C.textTertiary, marginBottom: 16 },

    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    tierBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: C.surfaceAlt,
    },
    tierBadgePremium: { backgroundColor: '#FEF3C7' },
    tierBadgeText: { fontSize: 12, fontWeight: '700', color: C.textSecondary },
    tierBadgeTextPremium: { color: '#92400E' },
    remaining: { fontSize: 13, color: C.textTertiary },
    remainingNumber: { fontWeight: '700', color: C.primary },

    moodSection: { marginBottom: 18 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: C.textTertiary,
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    moodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: C.surface,
      borderWidth: 1.5,
      borderColor: C.border,
    },
    moodChipActive: {
      backgroundColor: C.primarySurface,
      borderColor: C.primary,
    },
    moodEmoji: { fontSize: 14 },
    moodLabel: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
    moodLabelActive: { color: C.primary, fontWeight: '700' },

    cta: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      backgroundColor: C.primary,
      paddingVertical: 14,
      borderRadius: 14,
      marginBottom: 20,
      shadowColor: C.primary,
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    ctaDisabled: { opacity: 0.7 },
    ctaText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    errorBox: {
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 20,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: C.border,
    },
    errorIcon: { fontSize: 36, marginBottom: 8 },
    errorTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
    errorText: { fontSize: 13, color: C.textTertiary, textAlign: 'center', marginBottom: 8 },
    resetText: { fontSize: 12, color: C.textMuted, marginBottom: 12 },
    upgradeBtn: {
      backgroundColor: C.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    upgradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    retryBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: C.primary,
    },
    retryBtnText: { color: C.primary, fontWeight: '700', fontSize: 14 },

    noteBox: {
      backgroundColor: C.surfaceAlt,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    noteText: { fontSize: 13, color: C.textSecondary, fontStyle: 'italic', lineHeight: 19 },

    resultsSection: { marginTop: 4 },

    emptyState: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  });
}

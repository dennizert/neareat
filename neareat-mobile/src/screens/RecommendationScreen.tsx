/**
 * RecommendationScreen — "Bu akşam ne yesem?" ana ekranı (Sprint-1 Task #8).
 * Sprint-3 Task #5: streamDinnerRecommendation ile progressive kart reveal,
 * Durdur butonu, skeleton loading.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAiRecommendationStore } from '../store/aiRecommendationStore';
import { getCurrentLocation } from '../services/location';
import RecommendationCard from '../components/RecommendationCard';
import AiThinkingAnimation from '../components/AiThinkingAnimation';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

const REFINE_CHIPS = ['Daha ucuz', 'Daha yakın', 'Daha sessiz'] as const;

export default function RecommendationScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

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
    feedbackByPlaceId,
    streamingStatus,
    refining,
    streamDinnerRecommendation,
    submitFeedback,
  } = useAiRecommendationStore();

  const [locating, setLocating] = useState(false);
  const [refineText, setRefineText] = useState('');
  // Refinement aynı konumu yeniden kullanır — tekrar GPS sorgulamaya gerek yok
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Auto-navigate to PremiumUpsell on 429 — sadece false→true geçişinde
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
      lastCoordsRef.current = coords;
      setLocating(false);
      await streamDinnerRecommendation(coords.lat, coords.lng);
    } catch {
      setLocating(false);
    }
  }, [streamDinnerRecommendation]);

  const handleRefine = useCallback(async (instruction: string) => {
    const text = instruction.trim();
    if (!text) return;
    const coords = lastCoordsRef.current;
    if (!coords) return;
    setRefineText('');
    await streamDinnerRecommendation(coords.lat, coords.lng, text);
  }, [streamDinnerRecommendation]);

  const handleDetails = useCallback((placeId: string) => {
    navigation.navigate('RestaurantDetail', { placeId });
  }, [navigation]);

  const isBusy = locating || loading || refining;
  const hasResults = recommendations.length > 0;
  const showSkeleton = loading && !hasResults;
  // Refinement çubuğu: sonuç var, akış bitmiş, hata/limit yok
  const canRefine =
    hasResults && streamingStatus === 'done' && !limitReached && !noCandidates && !error;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: bottom + 16 }]}
      refreshControl={
        <RefreshControl refreshing={locating} onRefresh={handleFetch} tintColor={C.ai} />
      }
    >
      {/* Başlık */}
      <Text style={styles.title}>Şimdi ne yesem?</Text>
      <Text style={styles.subtitle}>
        Geçmişine ve tercihlerine göre kişisel öneri al
      </Text>

      {/* Tier rozeti */}
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

      {/* Ana CTA */}
      <TouchableOpacity
        style={[styles.cta, isBusy && styles.ctaDisabled]}
        onPress={handleFetch}
        disabled={isBusy}
        activeOpacity={0.85}
      >
        {(locating || loading) ? (
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

      {/* AI düşünme animasyonu — yükleme sırasında */}
      {showSkeleton && (
        <View style={styles.resultsSection}>
          <AiThinkingAnimation />
        </View>
      )}

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

      {/* Sonuç kartları — her biri fade-in ile */}
      {hasResults && (
        <View style={styles.resultsSection}>
          {recommendations.map((rec, i) => (
            <FadeInCard key={rec.placeId}>
              <RecommendationCard
                recommendation={rec}
                index={i + 1}
                onPressDetails={handleDetails}
                feedbackSentiment={feedbackByPlaceId[rec.placeId] ?? null}
                onFeedback={submitFeedback}
                neverVisited={rec.neverVisited ?? false}
              />
            </FadeInCard>
          ))}
        </View>
      )}

      {/* Refinement göstergesi — yeni öneri akışta, eski kartlar korunuyor */}
      {refining && (
        <View style={styles.refiningRow}>
          <ActivityIndicator color={C.ai} size="small" />
          <Text style={styles.refiningText}>İsteğine göre güncelleniyor…</Text>
        </View>
      )}

      {/* Konuşmaya dayalı refinement — sonuç geldikten sonra */}
      {canRefine && (
        <View style={styles.refineSection}>
          <Text style={styles.refineTitle}>Beğenmedin mi? İsteğini söyle:</Text>
          <View style={styles.chipRow}>
            {REFINE_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={styles.chip}
                onPress={() => handleRefine(chip)}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.refineInputRow}>
            <TextInput
              style={styles.refineInput}
              value={refineText}
              onChangeText={setRefineText}
              placeholder="örn. daha sessiz bir yer"
              placeholderTextColor={C.textMuted}
              maxLength={300}
              editable={!isBusy}
              onSubmitEditing={() => handleRefine(refineText)}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.refineSendBtn, (!refineText.trim() || isBusy) && styles.refineSendBtnDisabled]}
              onPress={() => handleRefine(refineText)}
              disabled={!refineText.trim() || isBusy}
              activeOpacity={0.85}
            >
              <Text style={styles.refineSendText}>Gönder</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Empty state */}
      {!hasResults && !loading && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🤔</Text>
          <Text style={styles.emptyText}>
            Konuma göre AI sana kişisel öneri hazırlasın — başlamak için butona dokun.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function FadeInCard({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

function SkeletonCard({ C }: { C: Colors }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        backgroundColor: C.surfaceAlt,
        borderRadius: 14,
        height: 120,
        marginBottom: 12,
        opacity,
      }}
    />
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

    tierRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    tierBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: C.surfaceAlt,
    },
    tierBadgePremium: { backgroundColor: C.amberSurface },
    tierBadgeText: { fontSize: 12, fontWeight: '700', color: C.textSecondary },
    tierBadgeTextPremium: { color: C.amber },
    remaining: { fontSize: 13, color: C.textTertiary },
    remainingNumber: { fontWeight: '700', color: C.ai },

    // AI ekranı: CTA AI moruyla — kullanıcı bu rengi "akıllı sistem" ile eşleştirir
    cta: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      backgroundColor: C.ai,
      paddingVertical: 14,
      borderRadius: 14,
      marginBottom: 12,
      shadowColor: C.ai,
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    ctaDisabled: { opacity: 0.7 },
    ctaText: { fontSize: 16, fontWeight: '700', color: C.aiOn },

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
    upgradeBtnText: { color: C.primaryOn, fontWeight: '700', fontSize: 14 },
    retryBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: C.ai,
    },
    retryBtnText: { color: C.ai, fontWeight: '700', fontSize: 14 },

    noteBox: {
      backgroundColor: C.surfaceAlt,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    noteText: { fontSize: 13, color: C.textSecondary, fontStyle: 'italic', lineHeight: 19 },

    resultsSection: { marginTop: 4 },

    refiningRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    refiningText: { fontSize: 13, color: C.ai, fontWeight: '600' },

    refineSection: {
      marginTop: 8,
      padding: 14,
      backgroundColor: C.surfaceAlt,
      borderRadius: 14,
    },
    refineTitle: { fontSize: 13, fontWeight: '700', color: C.textSecondary, marginBottom: 10 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: C.surface,
      borderWidth: 1.5,
      borderColor: C.ai,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: C.ai },
    refineInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    refineInput: {
      flex: 1,
      backgroundColor: C.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: C.textPrimary,
      borderWidth: 1,
      borderColor: C.border,
    },
    refineSendBtn: {
      backgroundColor: C.ai,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    refineSendBtnDisabled: { opacity: 0.5 },
    refineSendText: { color: C.aiOn, fontWeight: '700', fontSize: 14 },

    emptyState: { paddingVertical: 40, alignItems: 'center' },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  });
}

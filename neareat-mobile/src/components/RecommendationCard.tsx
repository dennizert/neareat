/**
 * RecommendationCard — AI Yemek Önerisi kart component'i (Sprint-1 Task #8)
 *
 * RestaurantCard'tan farkı:
 *  - LLM'in 2-3 cümle "neden bu?" gerekçesini öne çıkarır
 *  - "Detayları gör" butonu RestaurantDetail'a yönlendirir
 *  - Photo yok (LLM yanıtında photoUrl gelmiyor — backend'de zenginleştirilebilir gelecekte)
 *
 * Mevcut RestaurantCard.tsx ile aynı style sözleşmesine uyar — useTheme + makeStyles.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import type { AiRecommendation, FeedbackSentiment } from '../types';
import StarRating from './StarRating';
import { formatDistance } from '../utils/haversine';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

const PRICE_MAP: Record<number, string> = { 1: '₺', 2: '₺₺', 3: '₺₺₺', 4: '₺₺₺₺' };

interface Props {
  recommendation: AiRecommendation;
  /** Kart üstündeki sıra numarası (1, 2, 3) */
  index: number;
  onPressDetails: (placeId: string) => void;
  /** Mevcut feedback durumu (optimistic, store'dan gelir) */
  feedbackSentiment?: FeedbackSentiment | null;
  /** Feedback gönder callback — store.submitFeedback'e bağlanır */
  onFeedback?: (placeId: string, sentiment: FeedbackSentiment) => Promise<void>;
  /** Kullanıcı bu mekânı daha önce favorilememişse veya yorum yazmamışsa true */
  neverVisited?: boolean;
}

const RecommendationCard = React.memo(function RecommendationCard({
  recommendation: rec,
  index,
  onPressDetails,
  feedbackSentiment = null,
  onFeedback,
  neverVisited = false,
}: Props) {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const r = rec.restaurant;

  // Mutfak tipini Google place_types'tan kullanıcı dostu metne çevir
  // (restaurant + alt tip varsa alt tipi göster)
  const primaryType = (r.types || [])
    .filter((t) => t !== 'restaurant' && t !== 'food' && t !== 'point_of_interest' && t !== 'establishment')
    .slice(0, 2)
    .map(humanizeType)
    .join(', ') || 'Restoran';

  const [photoError, setPhotoError] = React.useState(false);
  const showPhoto = !!r.photoUrl && !photoError;
  const [submittingFeedback, setSubmittingFeedback] = React.useState(false);

  const handleFeedback = React.useCallback(
    async (sentiment: FeedbackSentiment) => {
      if (!onFeedback || submittingFeedback) return;
      // Already selected — no-op
      if (feedbackSentiment === sentiment) return;
      setSubmittingFeedback(true);
      try {
        await onFeedback(rec.placeId, sentiment);
      } catch {
        Alert.alert('Hata', 'Feedback gönderilemedi. Tekrar dene.');
      } finally {
        setSubmittingFeedback(false);
      }
    },
    [onFeedback, rec.placeId, feedbackSentiment, submittingFeedback]
  );

  return (
    <View style={styles.card}>
      {/* Restoran fotoğrafı — 16:9 (Sprint-2 Task #3) */}
      {showPhoto ? (
        <Image
          source={{ uri: r.photoUrl! }}
          style={styles.photo}
          onError={() => setPhotoError(true)}
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>🍽️</Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Sıra numarası + Restoran ismi */}
        <View style={styles.header}>
          <View style={styles.rank}>
            <Text style={styles.rankText}>{index}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name} numberOfLines={2}>
              {r.name}
            </Text>
            <Text style={styles.cuisine}>{primaryType}</Text>
          </View>
        </View>

        {/* Meta row: rating + distance + price */}
        <View style={styles.metaRow}>
          {r.rating != null && (
            <View style={styles.metaItem}>
              <StarRating rating={r.rating} size={14} />
              <Text style={styles.metaText}>
                {r.rating.toFixed(1)}
                {r.userRatingsTotal != null && ` (${r.userRatingsTotal})`}
              </Text>
            </View>
          )}
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.distance}>{formatDistance(r.distanceKm)}</Text>
          {r.priceLevel != null && PRICE_MAP[r.priceLevel] && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.price}>{PRICE_MAP[r.priceLevel]}</Text>
            </>
          )}
          {r.openNow === false && (
            <View style={styles.closedBadge}>
              <Text style={styles.closedText}>Kapalı</Text>
            </View>
          )}
        </View>

        {/* "Daha önce gitmediniz" uyarısı */}
        {neverVisited && (
          <View style={styles.newPlaceBadge}>
            <Text style={styles.newPlaceBadgeText}>✨ Daha önce gitmediniz</Text>
          </View>
        )}

        {/* LLM gerekçesi — bu kartın yıldız özelliği */}
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>🤖 Neden bu?</Text>
          <Text style={styles.reasonText}>{rec.reason}</Text>
        </View>

        {/* Adres + Detay CTA */}
        <View style={styles.footer}>
          {r.vicinity && (
            <Text style={styles.vicinity} numberOfLines={1}>
              {r.vicinity}
            </Text>
          )}
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => onPressDetails(rec.placeId)}
            activeOpacity={0.8}
          >
            <Text style={styles.detailsBtnText}>Detayları gör →</Text>
          </TouchableOpacity>
        </View>

        {/* 👍/👎 Feedback butonları (Sprint-2 Task #6) */}
        {onFeedback && (
          <View style={styles.feedbackRow}>
            <Text style={styles.feedbackLabel}>Bu öneri nasıldı?</Text>
            <View style={styles.feedbackBtns}>
              <TouchableOpacity
                style={[
                  styles.feedbackBtn,
                  feedbackSentiment === 'positive' && styles.feedbackBtnPositiveActive,
                ]}
                onPress={() => handleFeedback('positive')}
                disabled={submittingFeedback}
                activeOpacity={0.7}
              >
                <Text style={styles.feedbackBtnText}>👍</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.feedbackBtn,
                  feedbackSentiment === 'negative' && styles.feedbackBtnNegativeActive,
                ]}
                onPress={() => handleFeedback('negative')}
                disabled={submittingFeedback}
                activeOpacity={0.7}
              >
                <Text style={styles.feedbackBtnText}>👎</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
});

export default RecommendationCard;

/**
 * Google place type → Türkçe kullanıcı dostu metin.
 * Minimum mapping — yeterli için. Geniş mapping ihtiyacı duyulursa utils'e taşınır.
 */
function humanizeType(type: string): string {
  const map: Record<string, string> = {
    italian_restaurant: 'İtalyan',
    japanese_restaurant: 'Japon',
    chinese_restaurant: 'Çin',
    turkish_restaurant: 'Türk',
    mexican_restaurant: 'Meksika',
    indian_restaurant: 'Hint',
    thai_restaurant: 'Tay',
    french_restaurant: 'Fransız',
    seafood_restaurant: 'Deniz Ürünleri',
    steak_house: 'Steakhouse',
    sushi_restaurant: 'Suşi',
    pizza_restaurant: 'Pizza',
    cafe: 'Kafe',
    bakery: 'Fırın',
    meal_takeaway: 'Paket Servis',
    meal_delivery: 'Eve Servis',
    bar: 'Bar',
    night_club: 'Gece Kulübü',
    fast_food_restaurant: 'Fast Food',
  };
  if (map[type]) return map[type];
  // Fallback — snake_case → Capitalize Words
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      marginBottom: 14,
      overflow: 'hidden',
      shadowColor: C.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
      borderLeftWidth: 4,
      borderLeftColor: C.primary,
    },
    content: {
      padding: 16,
    },

    photo: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: C.border,
    },
    photoPlaceholder: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: C.primarySurface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    photoPlaceholderText: {
      fontSize: 40,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 10,
      gap: 10,
    },
    rank: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: C.primarySurface,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    rankText: {
      fontSize: 14,
      fontWeight: '700',
      color: C.primary,
    },
    headerInfo: { flex: 1 },
    name: {
      fontSize: 17,
      fontWeight: '700',
      color: C.textPrimary,
      marginBottom: 2,
    },
    cuisine: {
      fontSize: 13,
      color: C.textTertiary,
    },

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
      flexWrap: 'wrap',
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
    metaDot: { fontSize: 13, color: C.textMuted },
    distance: { fontSize: 13, color: C.primary, fontWeight: '600' },
    price: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
    closedBadge: {
      backgroundColor: C.errorSurface,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginLeft: 4,
    },
    closedText: { fontSize: 11, color: C.error, fontWeight: '600' },

    newPlaceBadge: {
      alignSelf: 'flex-start',
      backgroundColor: '#F0FDF4',
      borderWidth: 1,
      borderColor: '#86EFAC',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 10,
    },
    newPlaceBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#16A34A',
    },

    reasonBox: {
      backgroundColor: C.primarySurface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    reasonLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: C.primary,
      marginBottom: 4,
      letterSpacing: 0.2,
    },
    reasonText: {
      fontSize: 14,
      color: C.textPrimary,
      lineHeight: 20,
    },

    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    vicinity: {
      flex: 1,
      fontSize: 12,
      color: C.textMuted,
    },
    detailsBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: C.primary,
      borderRadius: 20,
    },
    detailsBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },

    feedbackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    feedbackLabel: {
      fontSize: 12,
      color: C.textMuted,
    },
    feedbackBtns: {
      flexDirection: 'row',
      gap: 8,
    },
    feedbackBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: C.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.surface,
    },
    feedbackBtnPositiveActive: {
      borderColor: '#16A34A',
      backgroundColor: '#F0FDF4',
    },
    feedbackBtnNegativeActive: {
      borderColor: '#DC2626',
      backgroundColor: '#FEF2F2',
    },
    feedbackBtnText: {
      fontSize: 16,
    },
  });
}

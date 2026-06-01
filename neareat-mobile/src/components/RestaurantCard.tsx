import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image'; // disk/memory cache + yumuşak geçiş
import type { Restaurant } from '../types';
import { formatDistance } from '../utils/haversine';
import StarRating from './StarRating';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

const PRICE_MAP: Record<number, string> = { 1: '₺', 2: '₺₺', 3: '₺₺₺', 4: '₺₺₺₺' };

interface Props {
  restaurant: Restaurant;
  onPress: () => void;
  closingSoon?: boolean;
  closingVerySoon?: boolean;
  minutesUntilClose?: number | null;
}

const RestaurantCard = React.memo(function RestaurantCard({ restaurant: r, onPress, closingSoon, closingVerySoon, minutesUntilClose }: Props) {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const showClosingSoon = r.isOpenNow && (closingSoon || closingVerySoon);

  const starPct = r.discount?.starDiscountPercent ?? 0;
  const instantPct = (r.discount?.instantActive && r.discount.instantPercent) ? r.discount.instantPercent : 0;
  const showInstant = instantPct > 0 && instantPct >= starPct;
  const showStar = starPct > 0 && starPct > instantPct;

  function renderBadge() {
    if (r.isOpenNow == null) return null;
    if (!r.isOpenNow) {
      return (
        <View style={[styles.badge, styles.closedBadge]}>
          <Text style={[styles.badgeText, styles.badgeTextClosed]}>Kapalı</Text>
        </View>
      );
    }
    if (closingVerySoon) {
      return (
        <View style={[styles.badge, styles.closingVeryBadge]}>
          <Text style={[styles.badgeText, styles.badgeTextClosed]}>⚠️ {minutesUntilClose} dk</Text>
        </View>
      );
    }
    if (closingSoon) {
      return (
        <View style={[styles.badge, styles.closingSoonBadge]}>
          <Text style={[styles.badgeText, styles.badgeTextWarn]}>🕐 {minutesUntilClose} dk</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.openBadge]}>
        <Text style={[styles.badgeText, styles.badgeTextOpen]}>Açık</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        showClosingSoon && (closingVerySoon ? styles.cardClosingVery : styles.cardClosingSoon),
        !showClosingSoon && showInstant && styles.cardInstantDiscount,
        !showClosingSoon && !showInstant && showStar && styles.cardStarDiscount,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {r.photoUrl ? (
        <Image source={{ uri: r.photoUrl }} style={styles.photo} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.photoPlaceholderText}>🍽️</Text>
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
          {renderBadge()}
        </View>
        <View style={styles.metaRow}>
          <StarRating rating={r.rating} size={12} />
          <Text style={styles.metaText}>{r.rating} ({r.userRatingsTotal})</Text>
          {r.priceLevel != null && <Text style={styles.metaText}>· {PRICE_MAP[r.priceLevel]}</Text>}
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.distance}>{formatDistance(r.distanceKm)}</Text>
          {showInstant && (
            <View style={styles.discountBadgeInstant}>
              <Text style={styles.discountBadgeText}>⚡ %{instantPct} Anlık!</Text>
            </View>
          )}
          {showStar && (
            <View style={styles.discountBadgeStar}>
              <Text style={[styles.discountBadgeText, styles.discountBadgeTextStar]}>⭐ %{starPct} İndirim</Text>
            </View>
          )}
        </View>
        {r.cuisineTags && r.cuisineTags.length > 0 && (
          <View style={styles.tagRow}>
            {r.cuisineTags.slice(0, 2).map((tag) => (
              <View key={tag} style={styles.cuisineTag}>
                <Text style={styles.cuisineTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        {r.isNewlyOpened && (
          <Text style={styles.newPlaceBadge}>✨ Yeni Mekan</Text>
        )}
        {r.announcement && (
          <Text style={styles.announcement} numberOfLines={1}>📢 {r.announcement}</Text>
        )}
        {r.acceptsReservations && (
          <Text style={styles.reservationBadge}>📅 Rezervasyon</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default RestaurantCard;

function makeStyles(C: Colors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, marginBottom: 12,
      overflow: 'hidden', shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    cardClosingSoon: { borderLeftWidth: 3, borderLeftColor: C.warning },
    cardClosingVery: { borderLeftWidth: 3, borderLeftColor: C.error },
    cardInstantDiscount: { borderLeftWidth: 3, borderLeftColor: C.warning, backgroundColor: C.warningSurface },
    cardStarDiscount: { borderLeftWidth: 3, borderLeftColor: C.amber, backgroundColor: C.amberSurface },
    photo: { width: 90, height: 90 },
    photoPlaceholder: { backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
    photoPlaceholderText: { fontSize: 28 },
    info: { flex: 1, padding: 12, justifyContent: 'center' },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    name: { fontSize: 15, fontWeight: '700', color: C.textPrimary, flex: 1, marginRight: 8 },
    badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    openBadge: { backgroundColor: C.successSurface },
    closedBadge: { backgroundColor: C.errorSurface },
    closingSoonBadge: { backgroundColor: C.warningSurface },
    closingVeryBadge: { backgroundColor: C.errorSurface },
    badgeText: { fontSize: 11, fontWeight: '600', color: C.textSecondary },
    badgeTextOpen: { color: C.success },
    badgeTextClosed: { color: C.error },
    badgeTextWarn: { color: C.warning },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    metaText: { fontSize: 12, color: C.textTertiary },
    bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    distance: { fontSize: 13, color: C.travel, fontWeight: '600' },
    discountBadgeInstant: { backgroundColor: C.warningSurface, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    discountBadgeStar: { backgroundColor: C.amberSurface, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    discountBadgeText: { fontSize: 10, fontWeight: '700', color: C.warning },
    discountBadgeTextStar: { color: C.amber },
    tagRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
    cuisineTag: {
      backgroundColor: C.surfaceAlt, borderRadius: 8,
      paddingHorizontal: 7, paddingVertical: 2,
    },
    cuisineTagText: { fontSize: 10, fontWeight: '600', color: C.textMuted },
    announcement: { fontSize: 11, color: C.textSecondary, marginTop: 3, fontStyle: 'italic' },
    reservationBadge: { fontSize: 11, color: C.success, marginTop: 3, fontWeight: '600' },
    newPlaceBadge: { fontSize: 11, color: C.travel, marginTop: 3, fontWeight: '700' },
  });
}

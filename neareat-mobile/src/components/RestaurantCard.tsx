import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import type { Restaurant } from '../types';
import { formatDistance } from '../utils/haversine';
import StarRating from './StarRating';

const PRICE_MAP: Record<number, string> = { 1: '₺', 2: '₺₺', 3: '₺₺₺', 4: '₺₺₺₺' };

interface Props {
  restaurant: Restaurant;
  onPress: () => void;
  closingSoon?: boolean;
  closingVerySoon?: boolean;
  minutesUntilClose?: number | null;
}

export default function RestaurantCard({ restaurant: r, onPress, closingSoon, closingVerySoon, minutesUntilClose }: Props) {
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
          <Text style={styles.badgeText}>Kapalı</Text>
        </View>
      );
    }
    if (closingVerySoon) {
      return (
        <View style={[styles.badge, styles.closingVeryBadge]}>
          <Text style={styles.badgeText}>⚠️ {minutesUntilClose} dk</Text>
        </View>
      );
    }
    if (closingSoon) {
      return (
        <View style={[styles.badge, styles.closingSoonBadge]}>
          <Text style={styles.badgeText}>🕐 {minutesUntilClose} dk</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.openBadge]}>
        <Text style={styles.badgeText}>Açık</Text>
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
        <Image source={{ uri: r.photoUrl }} style={styles.photo} />
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
              <Text style={styles.discountBadgeText}>⭐ %{starPct} İndirim</Text>
            </View>
          )}
        </View>
        {r.announcement && (
          <Text style={styles.announcement} numberOfLines={1}>📢 {r.announcement}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginBottom: 12,
    overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardClosingSoon: { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  cardClosingVery: { borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  cardInstantDiscount: { borderLeftWidth: 3, borderLeftColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  cardStarDiscount: { borderLeftWidth: 3, borderLeftColor: '#4F46E5', backgroundColor: '#F5F3FF' },
  photo: { width: 90, height: 90 },
  photoPlaceholder: { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  photoPlaceholderText: { fontSize: 28 },
  info: { flex: 1, padding: 12, justifyContent: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  openBadge: { backgroundColor: '#D1FAE5' },
  closedBadge: { backgroundColor: '#FEE2E2' },
  closingSoonBadge: { backgroundColor: '#FEF3C7' },
  closingVeryBadge: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#111827' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  metaText: { fontSize: 12, color: '#6B7280' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  distance: { fontSize: 13, color: '#FF6B35', fontWeight: '600' },
  discountBadgeInstant: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  discountBadgeStar: { backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  discountBadgeText: { fontSize: 10, fontWeight: '700', color: '#374151' },
  announcement: { fontSize: 11, color: '#4F46E5', marginTop: 3, fontStyle: 'italic' },
});

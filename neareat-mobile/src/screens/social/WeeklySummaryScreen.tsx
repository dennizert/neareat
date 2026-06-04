import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getReceivedRecommendations } from '../../services/social';
import type { Recommendation } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import AppIcon from '../../components/AppIcon';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { SkeletonCard } from '../../components/Skeleton';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isThisWeek(iso: string): boolean {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && Date.now() - t <= WEEK_MS;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

export default function WeeklySummaryScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await getReceivedRecommendations();
      // En yeni önce
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecs(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const weekCount = useMemo(() => recs.filter(r => isThisWeek(r.createdAt)).length, [recs]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  function openRestaurant(rec: Recommendation) {
    if (!rec.restaurant?.placeId) return;
    navigation.navigate('RestaurantDetail', { placeId: rec.restaurant.placeId });
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState message="Haftalık özet yüklenemedi." onRetry={load} />
      </View>
    );
  }

  function renderHeader() {
    return (
      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <AppIcon name="recommend" size={26} color={C.primary} />
        </View>
        <Text style={styles.summaryTitle}>
          {weekCount > 0
            ? `Bu hafta ${weekCount} restoran tavsiyesi aldın`
            : 'Bu hafta yeni tavsiye yok'}
        </Text>
        <Text style={styles.summaryDesc}>
          {weekCount > 0
            ? 'Arkadaşlarının önerdiği mekanlara göz at, beğendiklerini favorilerine ekle.'
            : 'Arkadaşların restoran önerdikçe burada haftalık özetini göreceksin.'}
        </Text>
      </View>
    );
  }

  function renderItem({ item }: { item: Recommendation }) {
    const fresh = isThisWeek(item.createdAt);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openRestaurant(item)} activeOpacity={0.85}>
        {/* Gönderen */}
        <View style={styles.fromRow}>
          {item.fromProfile?.photoUrl ? (
            <Image source={{ uri: item.fromProfile.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>
                {(item.fromProfile?.displayName ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.fromInfo}>
            <Text style={styles.fromName} numberOfLines={1}>
              {item.fromProfile?.displayName ?? 'Bir arkadaşın'} önerdi
            </Text>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
          {fresh && (
            <View style={styles.freshBadge}>
              <Text style={styles.freshText}>Bu hafta</Text>
            </View>
          )}
        </View>

        {/* Mekan */}
        <View style={styles.placeRow}>
          {item.restaurant?.photoUrl ? (
            <Image source={{ uri: item.restaurant.photoUrl }} style={styles.placeImg} />
          ) : (
            <View style={[styles.placeImg, styles.placeImgPlaceholder]}>
              <AppIcon name="restaurant" size={22} color={C.textMuted} />
            </View>
          )}
          <View style={styles.placeInfo}>
            <Text style={styles.placeName} numberOfLines={2}>{item.restaurant?.name ?? 'Restoran'}</Text>
            {item.restaurant?.rating ? (
              <View style={styles.ratingRow}>
                <AppIcon name="star" size={13} color={C.warning} />
                <Text style={styles.rating}>{item.restaurant.rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
          <AppIcon name="chevronRight" size={20} color={C.textMuted} />
        </View>

        {/* Mesaj */}
        {item.message ? (
          <Text style={styles.message} numberOfLines={3}>“{item.message}”</Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={recs}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="recommend"
            title="Henüz tavsiye almadın"
            description="Arkadaşların sana restoran önerdiğinde burada görünecek."
          />
        }
      />
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    list: { padding: 16, flexGrow: 1, gap: 12 },

    summaryCard: {
      backgroundColor: C.surface, borderRadius: 16, padding: 18, alignItems: 'center',
      shadowColor: C.shadow, shadowOpacity: 0.05, shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    summaryIcon: {
      width: 52, height: 52, borderRadius: 26, backgroundColor: C.primaryLight,
      alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    },
    summaryTitle: { fontSize: 17, fontWeight: '800', color: C.textPrimary, textAlign: 'center' },
    summaryDesc: { fontSize: 13, color: C.textTertiary, textAlign: 'center', lineHeight: 19, marginTop: 6 },

    card: {
      backgroundColor: C.surface, borderRadius: 16, padding: 14,
      shadowColor: C.shadow, shadowOpacity: 0.05, shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    fromRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
    avatarPlaceholder: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: C.primaryLight,
      alignItems: 'center', justifyContent: 'center', marginRight: 10,
    },
    avatarLetter: { fontSize: 15, fontWeight: '700', color: C.primary },
    fromInfo: { flex: 1 },
    fromName: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
    date: { fontSize: 12, color: C.textMuted, marginTop: 1 },
    freshBadge: {
      backgroundColor: C.successSurface, borderRadius: 10,
      paddingHorizontal: 9, paddingVertical: 3,
    },
    freshText: { fontSize: 11, fontWeight: '700', color: C.success },

    placeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    placeImg: { width: 56, height: 56, borderRadius: 12, backgroundColor: C.surfaceAlt },
    placeImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    placeInfo: { flex: 1 },
    placeName: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    rating: { fontSize: 13, fontWeight: '600', color: C.textSecondary },

    message: {
      fontSize: 13, color: C.textSecondary, fontStyle: 'italic', lineHeight: 19,
      marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.separator,
    },
  });
}

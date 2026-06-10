/**
 * ActivityFeedScreen — Arkadaş aktivite akışı (Sprint-4 Task #6).
 * GET /api/social/feed → kronolojik kartlar, pull-to-refresh, sonsuz scroll.
 */
import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useActivityFeedStore } from '../../store/activityFeedStore';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import type { ActivityEvent, ActivityEventType } from '../../types';

const ACTION_TEXT: Record<ActivityEventType, string> = {
  REVIEW: 'yorum yaptı',
  FAVORITE: 'favoriledi',
  RESERVATION: 'rezervasyon yaptı',
  RECOMMENDATION: 'önerdi',
  CHECKIN: 'şu an burada',
};

const ACTION_ICON: Record<ActivityEventType, keyof typeof Ionicons.glyphMap> = {
  REVIEW: 'chatbubble-ellipses',
  FAVORITE: 'heart',
  RESERVATION: 'calendar',
  RECOMMENDATION: 'share-social',
  CHECKIN: 'location',
};

export default function ActivityFeedScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

  const {
    events,
    loading,
    refreshing,
    loadingMore,
    nextCursor,
    error,
    loadInitial,
    refresh,
    loadMore,
  } = useActivityFeedStore();

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handlePress = useCallback((event: ActivityEvent) => {
    if (event.placeId) {
      navigation.navigate('RestaurantDetail', { placeId: event.placeId });
    }
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: ActivityEvent }) => {
    const name = item.user.displayName || 'Bir arkadaşın';
    const place = item.metadata?.placeName;
    const action = ACTION_TEXT[item.type] ?? 'bir aktivite yaptı';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handlePress(item)}
        disabled={!item.placeId}
        activeOpacity={0.8}
      >
        {item.user.photoUrl ? (
          <Image source={{ uri: item.user.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>
            <Text style={styles.cardName}>{name}</Text>
            {place ? (
              <>
                {' '}<Text style={styles.cardPlace}>{place}</Text> mekanını {action}.
              </>
            ) : (
              <> bir mekanı {action}.</>
            )}
          </Text>
          <Text style={styles.cardTime}>{relativeTime(item.createdAt)}</Text>
        </View>
        <Ionicons name={ACTION_ICON[item.type] ?? 'ellipse'} size={18} color={C.primary} style={styles.cardIcon} />
      </TouchableOpacity>
    );
  }, [styles, C, handlePress]);

  // İlk yükleme
  if (loading && events.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  // Hata + boş
  if (error && events.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>⚠️</Text>
        <Text style={styles.emptyText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.85}>
          <Text style={styles.retryBtnText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={events.length === 0 ? styles.emptyContainer : [styles.listContent, { paddingBottom: bottom + 16 }]}
      data={events}
      keyExtractor={(e) => e.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.primary} />
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        loadingMore ? <ActivityIndicator color={C.primary} style={{ marginVertical: 16 }} /> : null
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>👀</Text>
          <Text style={styles.emptyTitle}>Henüz aktivite yok</Text>
          <Text style={styles.emptyText}>
            Arkadaşların yorum yaptıkça, favorileyip rezervasyon yaptıkça burada görünecek.
          </Text>
        </View>
      }
    />
  );
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    listContent: { padding: 12 },
    emptyContainer: { flexGrow: 1, justifyContent: 'center' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: C.border,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
    avatarFallback: { backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: 18, fontWeight: '700', color: C.textSecondary },
    cardBody: { flex: 1 },
    cardText: { fontSize: 14, color: C.textSecondary, lineHeight: 20 },
    cardName: { fontWeight: '700', color: C.textPrimary },
    cardPlace: { fontWeight: '700', color: C.primary },
    cardTime: { fontSize: 12, color: C.textMuted, marginTop: 3 },
    cardIcon: { marginLeft: 8 },

    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 6 },
    emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },

    retryBtn: {
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: C.primary,
    },
    retryBtnText: { color: C.primary, fontWeight: '700', fontSize: 14 },
  });
}

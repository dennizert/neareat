import React, { useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNotificationStore } from '../store/notificationStore';
import type { AppNotification } from '../types';

const TYPE_ICON: Record<string, string> = {
  FRIEND_REQUEST: '👋',
  INSTANT_DISCOUNT: '⚡',
  LEVEL_UP: '🎉',
  RECOMMENDATION: '📍',
  REVIEW_REPLY: '💬',
  FRIEND_SUGGESTION: '🤝',
  REPORT_RESOLVED: '⚖️',
};

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dakika önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
  return `${Math.floor(diff / 86400)} gün önce`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { notifications, loading, hasMore, unreadCount, fetchNotifications, loadMore, markRead, markAllRead, fetchUnreadCount } = useNotificationStore();

  useEffect(() => {
    fetchNotifications(1);
    fetchUnreadCount();
  }, []);

  async function handlePress(notif: AppNotification) {
    if (!notif.isRead) await markRead(notif.id);
    const placeId = notif.data?.placeId;
    if (placeId && (notif.type === 'INSTANT_DISCOUNT' || notif.type === 'REVIEW_REPLY' || notif.type === 'RECOMMENDATION')) {
      navigation.navigate('RestaurantDetail', { placeId });
    } else if (notif.type === 'LEVEL_UP') {
      navigation.navigate('Rewards');
    } else if (notif.type === 'FRIEND_SUGGESTION') {
      navigation.navigate('FriendSuggestions');
    }
  }

  const onRefresh = useCallback(() => fetchNotifications(1), [fetchNotifications]);

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBar} onPress={markAllRead}>
          <Text style={styles.markAllText}>Tümünü Okundu İşaretle ({unreadCount})</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        refreshControl={<RefreshControl refreshing={loading && notifications.length === 0} onRefresh={onRefresh} tintColor="#FF6B35" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.isRead && styles.itemUnread]}
            onPress={() => handlePress(item)}
            activeOpacity={0.75}
          >
            <Text style={styles.icon}>{TYPE_ICON[item.type] ?? '🔔'}</Text>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                {!item.isRead && <View style={styles.dot} />}
              </View>
              <Text style={styles.body} numberOfLines={3}>{item.body}</Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#FF6B35" />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>Henüz bildiriminiz yok</Text>
            </View>
          )
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          hasMore ? <ActivityIndicator style={{ margin: 16 }} color="#FF6B35" /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  markAllBar: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
  },
  markAllText: { color: '#FF6B35', fontWeight: '600', fontSize: 13 },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  itemUnread: { backgroundColor: '#FFF7ED' },
  icon: { fontSize: 26, marginTop: 2 },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  title: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B35' },
  body: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  time: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },

  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#6B7280' },
});

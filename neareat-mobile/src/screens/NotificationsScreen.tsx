import React, { useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNotificationStore } from '../store/notificationStore';
import { notificationTarget } from '../utils/notificationTarget';
import type { AppNotification } from '../types';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

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
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    fetchNotifications(1);
    fetchUnreadCount();
  }, []);

  async function handlePress(notif: AppNotification) {
    if (!notif.isRead) await markRead(notif.id);
    // Merkezi eşleyici: tip + data → hedef ekran (eşleşme yoksa yalnızca okundu).
    const target = notificationTarget(notif.type, notif.data);
    if (target) navigation.navigate(target.screen, target.params);
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
        refreshControl={<RefreshControl refreshing={loading && notifications.length === 0} onRefresh={onRefresh} tintColor={C.primary} />}
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
            <ActivityIndicator style={{ marginTop: 60 }} size="large" color={C.primary} />
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
          hasMore ? <ActivityIndicator style={{ margin: 16 }} color={C.primary} /> : null
        }
      />
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    markAllBar: {
      backgroundColor: C.primarySurface,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.primaryLight,
    },
    markAllText: { color: C.primary, fontWeight: '600', fontSize: 13 },

    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: C.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.separator,
      gap: 12,
    },
    itemUnread: { backgroundColor: C.primarySurface },
    icon: { fontSize: 26, marginTop: 2 },
    content: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
    title: { fontSize: 14, fontWeight: '700', color: C.textPrimary, flex: 1, marginRight: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
    body: { fontSize: 13, color: C.textSecondary, lineHeight: 18 },
    time: { fontSize: 11, color: C.textMuted, marginTop: 4 },

    emptyContainer: { alignItems: 'center', marginTop: 80 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 16, color: C.textTertiary },
  });
}

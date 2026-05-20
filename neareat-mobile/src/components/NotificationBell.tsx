import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  FlatList, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useNotificationStore } from '../store/notificationStore';
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
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return `${Math.floor(diff / 86400)} gün önce`;
}

export default function NotificationBell() {
  const navigation = useNavigation<any>();
  const { unreadCount, notifications, loading, fetchUnreadCount, fetchNotifications, markRead, markAllRead } = useNotificationStore();
  const [panelVisible, setPanelVisible] = useState(false);

  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  const openPanel = useCallback(async () => {
    setPanelVisible(true);
    await fetchNotifications(1);
    await fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  async function handleNotifPress(notif: AppNotification) {
    if (!notif.isRead) await markRead(notif.id);
    const placeId = notif.data?.placeId;
    if (placeId && (notif.type === 'INSTANT_DISCOUNT' || notif.type === 'REVIEW_REPLY' || notif.type === 'RECOMMENDATION')) {
      setPanelVisible(false);
      navigation.navigate('RestaurantDetail', { placeId });
    } else if (notif.type === 'LEVEL_UP') {
      setPanelVisible(false);
      navigation.navigate('Rewards');
    } else if (notif.type === 'FRIEND_SUGGESTION') {
      setPanelVisible(false);
      navigation.navigate('FriendSuggestions');
    }
  }

  function handleSeeAll() {
    setPanelVisible(false);
    navigation.navigate('Notifications');
  }

  const preview = notifications.slice(0, 8);

  return (
    <>
      {/* Zil ikonu */}
      <TouchableOpacity onPress={openPanel} style={styles.bell} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="notifications-outline" size={24} color={C.textPrimary} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Panel modal */}
      <Modal
        visible={panelVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPanelVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setPanelVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <SafeAreaView>
              <View style={styles.panel}>
                {/* Panel başlık */}
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Bildirimler</Text>
                  {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllRead}>
                      <Text style={styles.markAllBtn}>Tümünü Okundu İşaretle</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {loading && notifications.length === 0 ? (
                  <ActivityIndicator style={{ padding: 20 }} color={C.primary} />
                ) : preview.length === 0 ? (
                  <Text style={styles.emptyText}>Henüz bildiriminiz yok</Text>
                ) : (
                  <FlatList
                    data={preview}
                    keyExtractor={n => n.id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.notifItem, !item.isRead && styles.notifUnread]}
                        onPress={() => handleNotifPress(item)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.notifIcon}>{TYPE_ICON[item.type] ?? '🔔'}</Text>
                        <View style={styles.notifContent}>
                          <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                          <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
                        </View>
                        {!item.isRead && <View style={styles.unreadDot} />}
                      </TouchableOpacity>
                    )}
                  />
                )}

                {/* Tümünü Gör */}
                <TouchableOpacity style={styles.seeAllBtn} onPress={handleSeeAll}>
                  <Text style={styles.seeAllText}>Tümünü Gör</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.primary} />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    bell: {
      position: 'relative',
      padding: 4,
    },
    badge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: C.error,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 3,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    backdrop: {
      flex: 1,
      backgroundColor: C.overlay,
      alignItems: 'flex-end',
      paddingTop: 56,
      paddingRight: 8,
    },
    panel: {
      backgroundColor: C.surface,
      borderRadius: 16,
      width: 320,
      maxHeight: 480,
      shadowColor: C.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
      overflow: 'hidden',
    },
    panelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.separator,
    },
    panelTitle: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    markAllBtn: { fontSize: 12, color: C.primary, fontWeight: '600' },

    emptyText: { padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 14 },

    notifItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.background,
      gap: 10,
    },
    notifUnread: { backgroundColor: C.primarySurface },
    notifIcon: { fontSize: 22, marginTop: 2 },
    notifContent: { flex: 1 },
    notifTitle: { fontSize: 13, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
    notifBody: { fontSize: 12, color: C.textTertiary, lineHeight: 17 },
    notifTime: { fontSize: 11, color: C.textMuted, marginTop: 3 },
    unreadDot: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: C.primary, marginTop: 6,
    },

    seeAllBtn: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 4,
      borderTopWidth: 1,
      borderTopColor: C.separator,
    },
    seeAllText: { fontSize: 14, fontWeight: '600', color: C.primary },
  });
}

import React, { useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMessageStore } from '../../store/messageStore';
import type { Conversation } from '../../types';

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days} gün`;
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export default function MessagesScreen() {
  const navigation = useNavigation<any>();
  const { conversations, fetchConversations } = useMessageStore();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    await fetchConversations();
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  useFocusEffect(
    useCallback(() => { fetchConversations(); }, [fetchConversations]),
  );

  function renderItem({ item }: { item: Conversation }) {
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate('Conversation', {
          userId: item.userId,
          displayName: item.profile.displayName,
          photoUrl: item.profile.photoUrl,
        })}
        activeOpacity={0.75}
      >
        <View style={styles.avatarWrap}>
          {item.profile.photoUrl ? (
            <Image source={{ uri: item.profile.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>
                {item.profile.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {item.unreadCount > 0 && (
            <View style={styles.unreadDot}>
              <Text style={styles.unreadDotText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={[styles.name, item.unreadCount > 0 && styles.nameBold]}>
              {item.profile.displayName}
            </Text>
            <Text style={styles.time}>{timeAgo(item.lastMessage.createdAt)}</Text>
          </View>
          <Text
            style={[styles.preview, item.unreadCount > 0 && styles.previewBold]}
            numberOfLines={1}
          >
            {item.lastMessage.isMine ? 'Sen: ' : ''}{item.lastMessage.content}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#FF6B35" />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={c => c.userId}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#FF6B35" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Henüz mesaj yok</Text>
            <Text style={styles.emptySubtitle}>Arkadaşlarınızın profiline giderek mesaj gönderebilirsiniz.</Text>
          </View>
        }
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  item: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FFE8DF', alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 22, fontWeight: '700', color: '#FF6B35' },
  unreadDot: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#FF6B35', borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 2, borderColor: '#fff',
  },
  unreadDotText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  content: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  name: { fontSize: 15, fontWeight: '500', color: '#111827', flex: 1, marginRight: 8 },
  nameBold: { fontWeight: '700' },
  time: { fontSize: 11, color: '#9CA3AF' },
  preview: { fontSize: 13, color: '#9CA3AF' },
  previewBold: { color: '#374151', fontWeight: '600' },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});

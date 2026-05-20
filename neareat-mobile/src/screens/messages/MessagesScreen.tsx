import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMessageStore } from '../../store/messageStore';
import type { Conversation } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

type FilterTab = 'all' | 'unread';

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk`;
  if (diff < 86400) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days} gün`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export default function MessagesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { conversations, fetchConversations } = useMessageStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  const unreadTotal = conversations.filter(c => c.unreadCount > 0).length;

  const filtered = conversations.filter(c => {
    const matchesTab = activeTab === 'all' || c.unreadCount > 0;
    const matchesSearch = searchQuery === ''
      || c.profile.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  function renderItem({ item }: { item: Conversation }) {
    const isUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.cardUnread]}
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
          {isUnread && <View style={styles.unreadRing} />}
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text
              style={[styles.name, isUnread && styles.nameUnread]}
              numberOfLines={1}
            >
              {item.profile.displayName}
            </Text>
            <Text style={[styles.time, isUnread && styles.timeUnread]}>
              {formatTime(item.lastMessage.createdAt)}
            </Text>
          </View>
          <View style={styles.bottomRow}>
            <Text
              style={[styles.preview, isUnread && styles.previewUnread]}
              numberOfLines={1}
            >
              {item.lastMessage.isMine ? 'Sen: ' : ''}{item.lastMessage.content}
            </Text>
            {isUnread && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {item.unreadCount > 9 ? '9+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mesajlar</Text>
        <TouchableOpacity
          style={styles.composeBtn}
          onPress={() => navigation.navigate('Friends')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="create-outline" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={C.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Kişi ara..."
          placeholderTextColor={C.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close-circle" size={16} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            Tümü
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'unread' && styles.tabActive]}
          onPress={() => setActiveTab('unread')}
        >
          <Text style={[styles.tabText, activeTab === 'unread' && styles.tabTextActive]}>
            Okunmadı
          </Text>
          {unreadTotal > 0 && (
            <View style={[styles.tabBadge, activeTab === 'unread' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'unread' && styles.tabBadgeTextActive]}>
                {unreadTotal}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Conversation List */}
      <FlatList
        data={filtered}
        keyExtractor={c => c.userId}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.primary} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name={activeTab === 'unread' ? 'checkmark-done-circle-outline' : 'chatbubbles-outline'}
              size={72}
              color={C.border}
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'unread' ? 'Okunmamış mesaj yok' : searchQuery ? 'Sonuç bulunamadı' : 'Henüz mesaj yok'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'unread'
                ? 'Tüm mesajlarınızı okudunuz, harika!'
                : searchQuery
                  ? `"${searchQuery}" ile eşleşen konuşma bulunamadı.`
                  : 'Arkadaşlarınızın profiline giderek mesaj gönderebilirsiniz.'}
            </Text>
          </View>
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : { paddingBottom: 20 }}
      />
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    loadingContainer: {
      flex: 1, backgroundColor: C.background,
      justifyContent: 'center', alignItems: 'center',
    },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
      backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.separator,
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
    composeBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: C.primaryLighter,
      alignItems: 'center', justifyContent: 'center',
    },

    // Search
    searchWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.inputBg,
      marginHorizontal: 16, marginTop: 12, marginBottom: 4,
      borderRadius: 12,
      paddingHorizontal: 12, paddingVertical: 9,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, color: C.textPrimary, padding: 0 },

    // Filter Tabs
    tabRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    },
    tab: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 16, paddingVertical: 8,
      borderRadius: 20, backgroundColor: C.inputBg,
    },
    tabActive: { backgroundColor: C.primary },
    tabText: { fontSize: 14, fontWeight: '600', color: C.textTertiary },
    tabTextActive: { color: '#fff' },
    tabBadge: {
      backgroundColor: C.primary, borderRadius: 10,
      minWidth: 20, height: 20,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
    },
    tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
    tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
    tabBadgeTextActive: { color: '#fff' },

    // Card
    card: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface,
      paddingHorizontal: 16, paddingVertical: 13,
      gap: 12,
    },
    cardUnread: { backgroundColor: C.primarySurface },

    // Avatar
    avatarWrap: { position: 'relative' },
    avatar: { width: 54, height: 54, borderRadius: 27 },
    avatarPlaceholder: {
      width: 54, height: 54, borderRadius: 27,
      backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center',
    },
    avatarLetter: { fontSize: 22, fontWeight: '700', color: C.primary },
    unreadRing: {
      position: 'absolute', bottom: 0, right: 0,
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: C.primary,
      borderWidth: 2, borderColor: C.primarySurface,
    },

    // Content rows
    content: { flex: 1, minWidth: 0 },
    topRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 4,
    },
    bottomRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center',
    },

    name: { fontSize: 15, fontWeight: '500', color: C.textSecondary, flex: 1, marginRight: 8 },
    nameUnread: { fontWeight: '700', color: C.textPrimary },
    time: { fontSize: 11, color: C.textMuted, flexShrink: 0 },
    timeUnread: { color: C.primary, fontWeight: '600' },

    preview: { fontSize: 13, color: C.textMuted, flex: 1, marginRight: 8 },
    previewUnread: { color: C.textSecondary, fontWeight: '500' },

    badge: {
      backgroundColor: C.primary, borderRadius: 10,
      minWidth: 22, height: 22,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
      flexShrink: 0,
    },
    badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

    separator: { height: 1, backgroundColor: C.separator, marginLeft: 82 },

    // Empty
    emptyContainer: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, paddingTop: 80 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, marginTop: 20, marginBottom: 8 },
    emptySubtitle: { fontSize: 14, color: C.textTertiary, textAlign: 'center', lineHeight: 22 },
  });
}

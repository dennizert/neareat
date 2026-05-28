import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Image, Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useFriendStore } from '../../store/friendStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import {
  getFriends, getPendingRequests, searchUsers,
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend,
} from '../../services/social';
import type { UserProfile, Friend, FriendRequest } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

type Tab = 'friends' | 'requests' | 'search';

export default function FriendsScreen() {
  const navigation = useNavigation<any>();
  const { friends, pendingRequests, setFriends, addFriend, removeFriend: storeDel, setPendingRequests, removeRequest } = useFriendStore();
  const { addStarEvent } = useUserProfileStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  // Not modal state
  const [noteModal, setNoteModal] = useState<{ visible: boolean; userId: string; displayName: string } | null>(null);
  const [noteText, setNoteText] = useState('');

  useFocusEffect(useCallback(() => {
    async function load() {
      setLoading(true);
      const [fRes, rRes] = await Promise.allSettled([getFriends(), getPendingRequests()]);
      if (fRes.status === 'fulfilled') setFriends(fRes.value);
      if (rRes.status === 'fulfilled') setPendingRequests(rRes.value);
      setLoading(false);
    }
    load();
  }, []));

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const results = await searchUsers(q);
      setSearchResults(results);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  function openNoteModal(userId: string, displayName: string) {
    setNoteText('');
    setNoteModal({ visible: true, userId, displayName });
  }

  async function handleSendRequest(userId: string, note?: string) {
    try {
      await sendFriendRequest(userId, note);
      setSentRequests(prev => new Set(prev).add(userId));
      setNoteModal(null);
      setNoteText('');
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error;
      if (status === 409) {
        setSentRequests(prev => new Set(prev).add(userId));
        setNoteModal(null);
        setNoteText('');
      } else if (status === 400 && msg?.includes('arkadaş')) {
        Alert.alert('Zaten Arkadaşsınız', 'Bu kullanıcı arkadaş listenizde zaten var.');
      } else {
        Alert.alert('Hata', 'İstek gönderilemedi. Lütfen tekrar deneyin.');
      }
    }
  }

  async function handleAccept(req: FriendRequest) {
    try {
      const { friend, starEvent } = await acceptFriendRequest(req.id, req.fromProfile);
      addFriend(friend);
      removeRequest(req.id);
      addStarEvent(starEvent);
    } catch {
      Alert.alert('Hata', 'İstek kabul edilemedi.');
    }
  }

  async function handleReject(requestId: string) {
    try {
      await rejectFriendRequest(requestId);
      removeRequest(requestId);
    } catch {
      Alert.alert('Hata', 'İstek reddedilemedi.');
    }
  }

  async function handleRemoveFriend(friend: Friend) {
    Alert.alert(
      'Arkadaşlıktan Çıkar',
      `${friend.profile.displayName} ile arkadaşlığı bitirmek istiyor musun?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkar', style: 'destructive',
          onPress: async () => {
            await removeFriend(friend.id);
            storeDel(friend.id);
          },
        },
      ],
    );
  }

  function renderFriendItem({ item }: { item: Friend }) {
    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => navigation.navigate('FriendProfile', { userId: item.profile.id })}
      >
        <Avatar profile={item.profile} size={48} C={C} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.profile.displayName}</Text>
          <Text style={styles.userSub}>{item.profile.city || 'Konum belirtilmemiş'}</Text>
          <Text style={styles.userBadge}>{item.profile.badgeIcon} {item.profile.badge}</Text>
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => handleRemoveFriend(item)}
        >
          <Text style={styles.removeBtnText}>•••</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  function renderRequestItem({ item }: { item: FriendRequest }) {
    return (
      <View style={styles.userCard}>
        <Avatar profile={item.fromProfile} size={48} C={C} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.fromProfile.displayName}</Text>
          <Text style={styles.userSub}>{item.fromProfile.city || 'Konum belirtilmemiş'}</Text>
          {item.note ? (
            <Text style={styles.requestNote}>"{item.note}"</Text>
          ) : null}
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
            <Text style={styles.acceptBtnText}>Kabul</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
            <Text style={styles.rejectBtnText}>Reddet</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderSearchItem({ item }: { item: UserProfile & { isFriend?: boolean; hasPendingRequest?: boolean } }) {
    const sentLocal = sentRequests.has(item.id);
    const isFriend = item.isFriend || friends.some(f => f.profile.id === item.id);
    const isPending = item.hasPendingRequest || sentLocal;
    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => navigation.navigate('FriendProfile', { userId: item.id })}
      >
        <Avatar profile={item} size={48} C={C} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName}</Text>
          <Text style={styles.userSub}>{item.city || 'Konum belirtilmemiş'}</Text>
          <Text style={styles.userBadge}>{item.badgeIcon} {item.badge}</Text>
        </View>
        {isFriend ? (
          <View style={styles.friendLabel}>
            <Text style={styles.friendLabelText}>Arkadaşın</Text>
          </View>
        ) : isPending ? (
          <View style={styles.pendingLabel}>
            <Text style={styles.pendingLabelText}>Gönderildi</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => openNoteModal(item.id, item.displayName)}
          >
            <Text style={styles.addBtnText}>Ekle</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color={C.primary} />;
  }

  return (
    <View style={styles.container}>
      {/* Not Modal */}
      <Modal visible={noteModal?.visible ?? false} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Arkadaşlık İsteği Gönder</Text>
            <Text style={styles.modalSub}>
              <Text style={{ fontWeight: '700' }}>{noteModal?.displayName}</Text> kişisine not ekleyebilirsin (opsiyonel).
            </Text>
            <TextInput
              style={styles.modalInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Merhaba! Tanışmak istedim..."
              placeholderTextColor={C.textMuted}
              multiline
              maxLength={300}
            />
            <Text style={styles.charCount}>{noteText.length}/300</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setNoteModal(null); setNoteText(''); }}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSendBtn}
                onPress={() => noteModal && handleSendRequest(noteModal.userId, noteText || undefined)}
              >
                <Text style={styles.modalSendText}>Gönder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles.tabRow}>
        {([
          ['friends', `Arkadaşlar (${friends.length})`],
          ['requests', `İstekler${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}`],
          ['search', 'Kullanıcı Bul'],
        ] as [Tab, string][]).map(([tab, label]) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'search' && (
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="İsim ile ara..."
            placeholderTextColor={C.textMuted}
            autoFocus
          />
          {searchLoading && <ActivityIndicator size="small" color={C.primary} style={{ marginRight: 12 }} />}
        </View>
      )}

      {activeTab === 'friends' && (
        <FlatList
          data={friends}
          keyExtractor={i => i.id}
          renderItem={renderFriendItem}
          ListHeaderComponent={(
            <>
              <TouchableOpacity
                style={styles.suggestionBanner}
                onPress={() => navigation.navigate('ActivityFeed')}
              >
                <Text style={styles.suggestionBannerIcon}>📰</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionBannerTitle}>Arkadaş Aktiviteleri</Text>
                  <Text style={styles.suggestionBannerSub}>Arkadaşların son 7 günde ne yaptı?</Text>
                </View>
                <Text style={styles.suggestionBannerArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestionBanner}
                onPress={() => navigation.navigate('FriendSuggestions')}
              >
                <Text style={styles.suggestionBannerIcon}>🤝</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionBannerTitle}>Arkadaş Önerileri</Text>
                  <Text style={styles.suggestionBannerSub}>Ortak ilgi alanlarına göre öneriler</Text>
                </View>
                <Text style={styles.suggestionBannerArrow}>›</Text>
              </TouchableOpacity>
            </>
          )}
          ListEmptyComponent={<EmptyState text="Henüz arkadaşın yok. Kullanıcı ara ve eklemeye başla!" C={C} />}
          contentContainerStyle={friends.length === 0 ? { flex: 1 } : undefined}
        />
      )}

      {activeTab === 'requests' && (
        <FlatList
          data={pendingRequests}
          keyExtractor={i => i.id}
          renderItem={renderRequestItem}
          ListEmptyComponent={<EmptyState text="Bekleyen arkadaşlık isteği yok." C={C} />}
          contentContainerStyle={pendingRequests.length === 0 ? { flex: 1 } : undefined}
        />
      )}

      {activeTab === 'search' && (
        <FlatList
          data={searchResults}
          keyExtractor={i => i.id}
          renderItem={renderSearchItem}
          ListEmptyComponent={
            searchQuery.trim() && !searchLoading
              ? <EmptyState text="Kullanıcı bulunamadı." C={C} />
              : <EmptyState text="Arama yapmak için isim girin." C={C} />
          }
          contentContainerStyle={searchResults.length === 0 ? { flex: 1 } : undefined}
        />
      )}
    </View>
  );
}

function Avatar({ profile, size, C }: { profile: UserProfile; size: number; C: Colors }) {
  if (profile.photoUrl) {
    return (
      <Image
        source={{ uri: profile.photoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, marginRight: 12 }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12,
    }}>
      <Text style={{ fontSize: size * 0.45 }}>
        {profile.displayName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function EmptyState({ text, C }: { text: string; C: Colors }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    tabRow: { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderColor: C.border },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabBtnActive: { borderBottomWidth: 2, borderColor: C.primary },
    tabText: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
    tabTextActive: { color: C.primary, fontWeight: '700' },
    searchBox: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, margin: 12, borderRadius: 12,
      borderWidth: 1, borderColor: C.border, paddingHorizontal: 14,
    },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: C.textPrimary },
    userCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, marginHorizontal: 12, marginTop: 8,
      borderRadius: 14, padding: 14,
      shadowColor: C.shadow, shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    userInfo: { flex: 1 },
    userName: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    userSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
    userBadge: { fontSize: 12, color: C.primary, marginTop: 2 },
    removeBtn: { padding: 8 },
    removeBtnText: { fontSize: 18, color: C.textMuted },
    requestActions: { flexDirection: 'row', gap: 8 },
    acceptBtn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
    acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    rejectBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
    rejectBtnText: { color: C.textTertiary, fontWeight: '600', fontSize: 13 },
    addBtn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
    addBtnSent: { backgroundColor: C.inputBg },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    addBtnSentText: { color: C.textMuted },
    friendLabel: { backgroundColor: C.successSurface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.successSurface },
    friendLabelText: { color: C.success, fontWeight: '700', fontSize: 12 },
    pendingLabel: { backgroundColor: C.inputBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
    pendingLabelText: { color: C.textMuted, fontWeight: '700', fontSize: 12 },
    suggestionBanner: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.primarySurface, marginHorizontal: 12, marginTop: 10, marginBottom: 4,
      borderRadius: 14, padding: 14, gap: 12,
      borderWidth: 1, borderColor: C.primaryLight,
    },
    suggestionBannerIcon: { fontSize: 26 },
    suggestionBannerTitle: { fontSize: 14, fontWeight: '700', color: C.primary },
    suggestionBannerSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
    suggestionBannerArrow: { fontSize: 24, color: C.primary, fontWeight: '300' },
    requestNote: { fontSize: 12, color: C.textTertiary, fontStyle: 'italic', marginTop: 3, lineHeight: 16 },
    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, marginBottom: 6 },
    modalSub: { fontSize: 13, color: C.textTertiary, marginBottom: 16, lineHeight: 18 },
    modalInput: {
      backgroundColor: C.background, borderRadius: 12, borderWidth: 1, borderColor: C.border,
      padding: 12, fontSize: 14, color: C.textPrimary, minHeight: 80, textAlignVertical: 'top',
    },
    charCount: { fontSize: 11, color: C.textMuted, alignSelf: 'flex-end', marginTop: 4 },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
    modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    modalCancelText: { color: C.textTertiary, fontWeight: '600' },
    modalSendBtn: { flex: 1, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    modalSendText: { color: '#fff', fontWeight: '700' },
  });
}

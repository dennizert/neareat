import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Image, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFriendStore } from '../../store/friendStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import {
  getFriends, getPendingRequests, searchUsers,
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend,
} from '../../services/social';
import type { UserProfile, Friend, FriendRequest } from '../../types';

type Tab = 'friends' | 'requests' | 'search';

export default function FriendsScreen() {
  const navigation = useNavigation<any>();
  const { friends, pendingRequests, setFriends, addFriend, removeFriend: storeDel, setPendingRequests, removeRequest } = useFriendStore();
  const { addStarEvent } = useUserProfileStore();

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  // Not modal state
  const [noteModal, setNoteModal] = useState<{ visible: boolean; userId: string; displayName: string } | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [f, r] = await Promise.all([getFriends(), getPendingRequests()]);
        setFriends(f);
        setPendingRequests(r);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
    } catch {
      Alert.alert('Hata', 'İstek gönderilemedi.');
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
        <Avatar profile={item.profile} size={48} />
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
        <Avatar profile={item.fromProfile} size={48} />
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

  function renderSearchItem({ item }: { item: UserProfile }) {
    const sent = sentRequests.has(item.id);
    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => navigation.navigate('FriendProfile', { userId: item.id })}
      >
        <Avatar profile={item} size={48} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName}</Text>
          <Text style={styles.userSub}>{item.city || 'Konum belirtilmemiş'}</Text>
          <Text style={styles.userBadge}>{item.badgeIcon} {item.badge}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, sent && styles.addBtnSent]}
          onPress={() => !sent && openNoteModal(item.id, item.displayName)}
          disabled={sent}
        >
          <Text style={[styles.addBtnText, sent && styles.addBtnSentText]}>
            {sent ? 'Gönderildi' : 'Ekle'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#FF6B35" />;
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
              placeholderTextColor="#9CA3AF"
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
            placeholderTextColor="#9CA3AF"
            autoFocus
          />
          {searchLoading && <ActivityIndicator size="small" color="#FF6B35" style={{ marginRight: 12 }} />}
        </View>
      )}

      {activeTab === 'friends' && (
        <FlatList
          data={friends}
          keyExtractor={i => i.id}
          renderItem={renderFriendItem}
          ListHeaderComponent={(
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
          )}
          ListEmptyComponent={<EmptyState text="Henüz arkadaşın yok. Kullanıcı ara ve eklemeye başla!" />}
          contentContainerStyle={friends.length === 0 ? { flex: 1 } : undefined}
        />
      )}

      {activeTab === 'requests' && (
        <FlatList
          data={pendingRequests}
          keyExtractor={i => i.id}
          renderItem={renderRequestItem}
          ListEmptyComponent={<EmptyState text="Bekleyen arkadaşlık isteği yok." />}
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
              ? <EmptyState text="Kullanıcı bulunamadı." />
              : <EmptyState text="Arama yapmak için isim girin." />
          }
          contentContainerStyle={searchResults.length === 0 ? { flex: 1 } : undefined}
        />
      )}
    </View>
  );
}

function Avatar({ profile, size }: { profile: UserProfile; size: number }) {
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
      backgroundColor: '#FFE8DF', alignItems: 'center', justifyContent: 'center', marginRight: 12,
    }}>
      <Text style={{ fontSize: size * 0.45 }}>
        {profile.displayName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E5E7EB' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderColor: '#FF6B35' },
  tabText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  tabTextActive: { color: '#FF6B35', fontWeight: '700' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', margin: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#111827' },
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 8,
    borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  userSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  userBadge: { fontSize: 12, color: '#FF6B35', marginTop: 2 },
  removeBtn: { padding: 8 },
  removeBtnText: { fontSize: 18, color: '#9CA3AF' },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: '#FF6B35', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rejectBtn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  rejectBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 13 },
  addBtn: { backgroundColor: '#FF6B35', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnSent: { backgroundColor: '#F3F4F6' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  addBtnSentText: { color: '#9CA3AF' },
  suggestionBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF7ED', marginHorizontal: 12, marginTop: 10, marginBottom: 4,
    borderRadius: 14, padding: 14, gap: 12,
    borderWidth: 1, borderColor: '#FFEDD5',
  },
  suggestionBannerIcon: { fontSize: 26 },
  suggestionBannerTitle: { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  suggestionBannerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  suggestionBannerArrow: { fontSize: 24, color: '#FF6B35', fontWeight: '300' },
  requestNote: { fontSize: 12, color: '#6B7280', fontStyle: 'italic', marginTop: 3, lineHeight: 16 },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 18 },
  modalInput: {
    backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    padding: 12, fontSize: 14, color: '#111827', minHeight: 80, textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: '#9CA3AF', alignSelf: 'flex-end', marginTop: 4 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { color: '#6B7280', fontWeight: '600' },
  modalSendBtn: { flex: 1, backgroundColor: '#FF6B35', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  modalSendText: { color: '#fff', fontWeight: '700' },
});

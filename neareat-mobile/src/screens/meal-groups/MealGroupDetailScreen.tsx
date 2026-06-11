import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput,
  Modal, FlatList, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import type { MealGroup, RestaurantPoll, PollOption, PollVoteValue, Favorite, Friend } from '../../types';
import { getMealGroup, createPoll, votePoll, closePoll, addMealGroupMembers, createQuickPoll } from '../../services/mealGroups';
import { getFriends } from '../../services/social';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

// ─── Oy bar bileşeni ──────────────────────────────────────────────────────────

function VoteBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const { C } = useTheme();
  const pct = total > 0 ? count / total : 0;
  return (
    <View style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ flex: 1, height: 6, backgroundColor: C.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(pct * 100)}%`, height: 6, backgroundColor: color, borderRadius: 3 }} />
        </View>
        <Text style={{ fontSize: 12, color, fontWeight: '700', minWidth: 28, textAlign: 'right' }}>
          {count} {label}
        </Text>
      </View>
    </View>
  );
}

// ─── Üye avatar row ───────────────────────────────────────────────────────────

function MembersRow({ members, C, styles }: { members: MealGroup['members']; C: Colors; styles: any }) {
  return (
    <View style={styles.membersRow}>
      {members.map((m) => (
        <View key={m.userId} style={styles.memberItem}>
          <View style={[styles.memberAvatar, m.status === 'INVITED' && styles.memberAvatarInvited]}>
            {m.user.photoUrl ? (
              <Image source={{ uri: m.user.photoUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
            ) : (
              <Text style={styles.memberAvatarLetter}>{m.user.displayName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.memberName} numberOfLines={1}>{m.user.displayName.split(' ')[0]}</Text>
          <Text style={[styles.memberStatus, m.status === 'ACCEPTED' && styles.memberStatusAccepted, m.status === 'DECLINED' && styles.memberStatusDeclined]}>
            {m.status === 'ACCEPTED' ? '✓' : m.status === 'INVITED' ? '...' : '✗'}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Anket seçeneği bileşeni ──────────────────────────────────────────────────

function PollOptionCard({
  option,
  poll,
  myUserId,
  onVote,
  C,
  styles,
}: {
  option: PollOption;
  poll: RestaurantPoll;
  myUserId: string;
  onVote: (optionId: string, vote: PollVoteValue) => void;
  C: Colors;
  styles: any;
}) {
  const myVote = option.votes.find((v) => v.userId === myUserId)?.vote ?? null;
  const yesCount = option.votes.filter((v) => v.vote === 'YES').length;
  const maybeCount = option.votes.filter((v) => v.vote === 'MAYBE').length;
  const noCount = option.votes.filter((v) => v.vote === 'NO').length;
  const total = option.votes.length;
  const isOpen = poll.status === 'OPEN';

  return (
    <View style={[styles.optionCard, myVote === 'YES' && styles.optionCardYes]}>
      <View style={styles.optionHeader}>
        {option.placePhotoUrl ? (
          <Image source={{ uri: option.placePhotoUrl }} style={styles.optionPhoto} />
        ) : (
          <View style={[styles.optionPhoto, styles.optionPhotoPlaceholder]}>
            <Text style={{ fontSize: 20 }}>🍴</Text>
          </View>
        )}
        <View style={styles.optionInfo}>
          <Text style={styles.optionName} numberOfLines={2}>{option.placeName}</Text>
          {option.placeAddress && (
            <Text style={styles.optionAddress} numberOfLines={1}>{option.placeAddress}</Text>
          )}
          {option.placeRating && (
            <Text style={styles.optionRating}>⭐ {Number(option.placeRating).toFixed(1)}</Text>
          )}
        </View>
      </View>

      <View style={styles.voteBars}>
        <VoteBar label="Evet" count={yesCount} total={total} color={C.success} />
        <VoteBar label="Belki" count={maybeCount} total={total} color={C.amber} />
        <VoteBar label="Hayır" count={noCount} total={total} color={C.error} />
      </View>

      {isOpen && (
        <View style={styles.voteButtons}>
          <TouchableOpacity
            style={[styles.voteBtn, styles.voteBtnYes, myVote === 'YES' && styles.voteBtnActive]}
            onPress={() => onVote(option.id, 'YES')}
          >
            <Text style={[styles.voteBtnText, myVote === 'YES' && styles.voteBtnTextActive]}>Evet ✓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.voteBtn, styles.voteBtnMaybe, myVote === 'MAYBE' && styles.voteBtnActive]}
            onPress={() => onVote(option.id, 'MAYBE')}
          >
            <Text style={[styles.voteBtnText, myVote === 'MAYBE' && styles.voteBtnMaybeActive]}>Belki ~</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.voteBtn, styles.voteBtnNo, myVote === 'NO' && styles.voteBtnActive]}
            onPress={() => onVote(option.id, 'NO')}
          >
            <Text style={[styles.voteBtnText, myVote === 'NO' && styles.voteBtnTextActive]}>Hayır ✗</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isOpen && myVote && (
        <View style={styles.myVoteLabel}>
          <Text style={styles.myVoteLabelText}>Oyun: {myVote === 'YES' ? 'Evet' : myVote === 'MAYBE' ? 'Belki' : 'Hayır'}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function MealGroupDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { groupId } = route.params as { groupId: string };
  const { user } = useAuthStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

  const [group, setGroup] = useState<MealGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [quickPollLoading, setQuickPollLoading] = useState(false);

  // Modal: anket oluştur
  const [createPollVisible, setCreatePollVisible] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [selectedFavIds, setSelectedFavIds] = useState<Set<string>>(new Set());
  const [pollCreating, setPollCreating] = useState(false);

  // Modal: üye ekle
  const [addMembersVisible, setAddMembersVisible] = useState(false);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedNewIds, setSelectedNewIds] = useState<Set<string>>(new Set());
  const [addingMembers, setAddingMembers] = useState(false);
  const [friendQuery, setFriendQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getMealGroup(groupId);
      setGroup(data);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Grup yüklenemedi.');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function loadFavorites() {
    try {
      const { data } = await api.get('/favorites');
      setFavorites(data);
    } catch {
      // silent
    }
  }

  async function openAddMembers() {
    setSelectedNewIds(new Set());
    setFriendQuery('');
    setAddMembersVisible(true);
    setLoadingFriends(true);
    try {
      const data = await getFriends();
      // Zaten grupta olan üyeleri filtrele
      const existingIds = new Set(group?.members.map((m) => m.userId) ?? []);
      setFriendsList(data.filter((f) => !existingIds.has(f.userId)));
    } catch {
      // silent
    } finally {
      setLoadingFriends(false);
    }
  }

  function toggleNewFriend(userId: string) {
    setSelectedNewIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) { next.delete(userId); } else { next.add(userId); }
      return next;
    });
  }

  async function handleAddMembers() {
    if (selectedNewIds.size === 0) return;
    setAddingMembers(true);
    try {
      await addMealGroupMembers(groupId, [...selectedNewIds]);
      setAddMembersVisible(false);
      await load();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Üye eklenemedi.');
    } finally {
      setAddingMembers(false);
    }
  }

  function openCreatePoll() {
    setSelectedFavIds(new Set());
    setPollQuestion('');
    loadFavorites();
    setCreatePollVisible(true);
  }

  function toggleFav(fav: Favorite) {
    setSelectedFavIds((prev) => {
      const next = new Set(prev);
      if (next.has(fav.placeId)) { next.delete(fav.placeId); } else { next.add(fav.placeId); }
      return next;
    });
  }

  async function handleCreatePoll() {
    const selected = favorites.filter((f) => selectedFavIds.has(f.placeId));
    if (selected.length < 2) {
      Alert.alert('Hata', 'En az 2 restoran seçin.');
      return;
    }
    setPollCreating(true);
    try {
      await createPoll(groupId, {
        question: pollQuestion.trim() || undefined,
        options: selected.map((f) => ({
          placeId: f.placeId,
          placeName: f.placeName,
          placeAddress: f.placeAddress,
          placePhotoUrl: f.placePhotoUrl,
          placeRating: f.placeRating,
        })),
      });
      setCreatePollVisible(false);
      await load();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Anket oluşturulamadı.');
    } finally {
      setPollCreating(false);
    }
  }

  async function handleQuickPoll() {
    setQuickPollLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'Yakın restoranları görmek için konum iznine ihtiyaç var.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await createQuickPoll(groupId, { lat: loc.coords.latitude, lng: loc.coords.longitude });
      await load();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Hızlı anket oluşturulamadı.';
      Alert.alert('Hata', msg);
    } finally {
      setQuickPollLoading(false);
    }
  }

  async function handleVote(poll: RestaurantPoll, optionId: string, voteVal: PollVoteValue) {
    try {
      await votePoll(groupId, poll.id, optionId, voteVal);
      setGroup((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          polls: prev.polls.map((p) => {
            if (p.id !== poll.id) return p;
            return {
              ...p,
              options: p.options.map((opt) => {
                const withoutMe = opt.votes.filter((v) => v.userId !== user!.id);
                if (opt.id === optionId) {
                  return { ...opt, votes: [...withoutMe, { id: 'tmp', optionId, userId: user!.id, vote: voteVal, user: { id: user!.id, displayName: '', photoUrl: null }, createdAt: '', updatedAt: '' }] };
                }
                return { ...opt, votes: withoutMe };
              }),
            };
          }),
        };
      });
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Oy verilemedi.');
    }
  }

  async function handleClosePoll(poll: RestaurantPoll) {
    Alert.alert(
      'Anketi Kapat',
      'Anketi kapatmak istediğinizden emin misiniz? Tüm üyeler sonucu görecek.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kapat',
          style: 'destructive',
          onPress: async () => {
            try {
              await closePoll(groupId, poll.id);
              await load();
            } catch (err: any) {
              Alert.alert('Hata', err.response?.data?.error || 'İşlem başarısız.');
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>;
  }

  if (!group) return null;

  const openPoll = group.polls.find((p) => p.status === 'OPEN') ?? null;
  const closedPolls = group.polls.filter((p) => p.status === 'CLOSED');
  const isMember = group.myStatus === 'ACCEPTED';
  const isCreator = group.creatorId === user?.id;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
      >
        {/* Üyeler */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Üyeler ({group.members.length})</Text>
            {isMember && (
              <TouchableOpacity style={styles.addMemberBtn} onPress={openAddMembers}>
                <Ionicons name="person-add-outline" size={16} color={C.primary} />
                <Text style={styles.addMemberBtnText}>Ekle</Text>
              </TouchableOpacity>
            )}
          </View>
          <MembersRow members={group.members} C={C} styles={styles} />
        </View>

        {/* Aktif Anket */}
        {openPoll ? (
          <View style={styles.section}>
            <View style={styles.pollHeader}>
              <Text style={styles.sectionTitle}>Anket</Text>
              <View style={styles.openBadge}><Text style={styles.openBadgeText}>Açık</Text></View>
            </View>
            {openPoll.question && (
              <Text style={styles.pollQuestion}>{openPoll.question}</Text>
            )}
            {openPoll.options.map((opt) => (
              <PollOptionCard
                key={opt.id}
                option={opt}
                poll={openPoll}
                myUserId={user?.id ?? ''}
                onVote={(optId, v) => handleVote(openPoll, optId, v)}
                C={C}
                styles={styles}
              />
            ))}
            {(openPoll.creatorId === user?.id || isCreator) && (
              <TouchableOpacity style={styles.closePollBtn} onPress={() => handleClosePoll(openPoll)}>
                <Text style={styles.closePollBtnText}>Anketi Kapat ve Sonuçları Gör</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          isMember && (
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.quickPollBtn, quickPollLoading && styles.quickPollBtnDisabled]}
                onPress={handleQuickPoll}
                disabled={quickPollLoading}
              >
                {quickPollLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="location-outline" size={20} color="#fff" />
                    <Text style={styles.quickPollBtnText}>Şu an nereye? ⚡</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.createPollBtn} onPress={openCreatePoll}>
                <Ionicons name="bar-chart-outline" size={20} color={C.primary} />
                <Text style={styles.createPollBtnText}>Favorilerden Anket Başlat</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {/* Geçmiş Anketler */}
        {closedPolls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Geçmiş Anketler</Text>
            {closedPolls.map((poll) => {
              let winner: PollOption | null = null;
              let maxYes = -1;
              for (const opt of poll.options) {
                const yes = opt.votes.filter((v) => v.vote === 'YES').length;
                if (yes > maxYes) { maxYes = yes; winner = opt; }
              }
              return (
                <View key={poll.id} style={styles.closedPollCard}>
                  {poll.question && <Text style={styles.closedPollQuestion}>{poll.question}</Text>}
                  {winner && maxYes > 0 ? (
                    <View style={styles.winnerRow}>
                      <Text style={styles.winnerEmoji}>🏆</Text>
                      <Text style={styles.winnerName}>{winner.placeName}</Text>
                      <Text style={styles.winnerVotes}>{maxYes} evet</Text>
                    </View>
                  ) : (
                    <Text style={styles.noWinner}>Eşitlik — karar verilemedi</Text>
                  )}
                  <Text style={styles.closedPollDate}>
                    {new Date(poll.closedAt ?? poll.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Üye Ekle Modal */}
      <Modal visible={addMembersVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAddMembersVisible(false)}>
              <Text style={styles.modalCancel}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Üye Ekle</Text>
            <TouchableOpacity
              onPress={handleAddMembers}
              disabled={addingMembers || selectedNewIds.size === 0}
            >
              {addingMembers
                ? <ActivityIndicator size="small" color={C.primary} />
                : <Text style={[styles.modalDone, selectedNewIds.size === 0 && styles.modalDoneDisabled]}>Ekle</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={styles.friendSearchRow}>
            <Ionicons name="search" size={16} color={C.textMuted} />
            <TextInput
              style={styles.friendSearchInput}
              placeholder="İsme göre ara..."
              placeholderTextColor={C.textMuted}
              value={friendQuery}
              onChangeText={setFriendQuery}
            />
          </View>

          {loadingFriends ? (
            <ActivityIndicator size="small" color={C.primary} style={{ marginTop: 32 }} />
          ) : friendsList.length === 0 ? (
            <View style={styles.noFavs}>
              <Text style={styles.noFavsText}>Eklenebilecek arkadaşın yok. Tüm arkadaşların zaten bu grupta.</Text>
            </View>
          ) : (
            <FlatList
              data={friendsList.filter((f) =>
                f.profile.displayName.toLowerCase().includes(friendQuery.toLowerCase()),
              )}
              keyExtractor={(f) => f.userId}
              renderItem={({ item }) => {
                const selected = selectedNewIds.has(item.userId);
                return (
                  <TouchableOpacity
                    style={[styles.favItem, selected && styles.favItemSelected]}
                    onPress={() => toggleNewFriend(item.userId)}
                  >
                    {item.profile.photoUrl ? (
                      <Image source={{ uri: item.profile.photoUrl }} style={styles.favPhoto} />
                    ) : (
                      <View style={[styles.favPhoto, styles.favPhotoPlaceholder]}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: C.primary }}>
                          {item.profile.displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.favInfo}>
                      <Text style={styles.favName}>{item.profile.displayName}</Text>
                      {item.profile.city ? <Text style={styles.favAddress}>{item.profile.city}</Text> : null}
                    </View>
                    <View style={[styles.favCheck, selected && styles.favCheckSelected]}>
                      {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 32 }}
            />
          )}
        </View>
      </Modal>

      {/* Anket Oluştur Modal */}
      <Modal visible={createPollVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCreatePollVisible(false)}>
              <Text style={styles.modalCancel}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Anket Oluştur</Text>
            <TouchableOpacity
              onPress={handleCreatePoll}
              disabled={pollCreating || selectedFavIds.size < 2}
            >
              {pollCreating
                ? <ActivityIndicator size="small" color={C.primary} />
                : <Text style={[styles.modalDone, selectedFavIds.size < 2 && styles.modalDoneDisabled]}>Başlat</Text>
              }
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.questionInput}
            placeholder="Soru (isteğe bağlı): Bu hafta nereye gidelim?"
            placeholderTextColor={C.textMuted}
            value={pollQuestion}
            onChangeText={setPollQuestion}
            maxLength={300}
          />

          <Text style={styles.modalSubtitle}>Favorilerinden Seç <Text style={styles.modalSubCount}>({selectedFavIds.size} seçildi, min 2)</Text></Text>

          {favorites.length === 0 ? (
            <View style={styles.noFavs}>
              <Text style={styles.noFavsText}>Henüz favorin yok. Önce Keşfet'ten restoran favorile.</Text>
            </View>
          ) : (
            <FlatList
              data={favorites}
              keyExtractor={(f) => f.placeId}
              renderItem={({ item }) => {
                const selected = selectedFavIds.has(item.placeId);
                return (
                  <TouchableOpacity
                    style={[styles.favItem, selected && styles.favItemSelected]}
                    onPress={() => toggleFav(item)}
                  >
                    {item.placePhotoUrl ? (
                      <Image source={{ uri: item.placePhotoUrl }} style={styles.favPhoto} />
                    ) : (
                      <View style={[styles.favPhoto, styles.favPhotoPlaceholder]}>
                        <Text style={{ fontSize: 18 }}>🍴</Text>
                      </View>
                    )}
                    <View style={styles.favInfo}>
                      <Text style={styles.favName} numberOfLines={1}>{item.placeName}</Text>
                      {item.placeAddress && <Text style={styles.favAddress} numberOfLines={1}>{item.placeAddress}</Text>}
                      {item.placeRating && <Text style={styles.favRating}>⭐ {item.placeRating}</Text>}
                    </View>
                    <View style={[styles.favCheck, selected && styles.favCheckSelected]}>
                      {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 32 }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },

    section: { backgroundColor: C.surface, marginHorizontal: 16, marginTop: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    addMemberBtnText: { fontSize: 13, fontWeight: '600', color: C.primary },
    friendSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 8, backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12 },
    friendSearchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: C.textPrimary },

    // Members
    membersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    memberItem: { alignItems: 'center', width: 56 },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    memberAvatarInvited: { backgroundColor: C.textMuted, opacity: 0.7 },
    memberAvatarLetter: { fontSize: 16, fontWeight: '700', color: '#fff' },
    memberName: { fontSize: 10, color: C.textSecondary, textAlign: 'center' },
    memberStatus: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
    memberStatusAccepted: { color: C.success },
    memberStatusDeclined: { color: C.error },

    // Poll
    pollHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    openBadge: { backgroundColor: C.successSurface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    openBadgeText: { fontSize: 11, fontWeight: '700', color: C.success },
    pollQuestion: { fontSize: 14, color: C.textSecondary, marginBottom: 12, fontStyle: 'italic' },

    // Option card
    optionCard: { backgroundColor: C.background, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border },
    optionCardYes: { borderColor: C.success, borderWidth: 1.5 },
    optionHeader: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    optionPhoto: { width: 56, height: 56, borderRadius: 10, backgroundColor: C.border },
    optionPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    optionInfo: { flex: 1 },
    optionName: { fontSize: 14, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
    optionAddress: { fontSize: 12, color: C.textMuted, marginBottom: 2 },
    optionRating: { fontSize: 12, color: C.textSecondary },

    voteBars: { marginBottom: 10 },

    voteButtons: { flexDirection: 'row', gap: 8 },
    voteBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
    voteBtnYes: { borderColor: C.success, backgroundColor: 'transparent' },
    voteBtnMaybe: { borderColor: C.amber, backgroundColor: 'transparent' },
    voteBtnNo: { borderColor: C.error, backgroundColor: 'transparent' },
    voteBtnActive: { backgroundColor: C.success, borderColor: C.success },
    voteBtnText: { fontSize: 12, fontWeight: '700', color: C.textSecondary },
    voteBtnTextActive: { color: '#fff' },
    voteBtnMaybeActive: { color: C.amber },
    myVoteLabel: { alignSelf: 'flex-start', backgroundColor: C.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
    myVoteLabelText: { fontSize: 11, color: C.primary, fontWeight: '600' },

    closePollBtn: { marginTop: 12, borderWidth: 1, borderColor: C.error, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
    closePollBtnText: { color: C.error, fontWeight: '700', fontSize: 14 },

    quickPollBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
      marginBottom: 10,
    },
    quickPollBtnDisabled: { opacity: 0.6 },
    quickPollBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    createPollBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.primaryLight, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
    createPollBtnText: { color: C.primary, fontWeight: '700', fontSize: 15 },

    // Closed polls
    closedPollCard: { backgroundColor: C.background, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
    closedPollQuestion: { fontSize: 13, color: C.textSecondary, marginBottom: 6, fontStyle: 'italic' },
    winnerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    winnerEmoji: { fontSize: 18 },
    winnerName: { fontSize: 14, fontWeight: '700', color: C.textPrimary, flex: 1 },
    winnerVotes: { fontSize: 12, color: C.success, fontWeight: '600' },
    noWinner: { fontSize: 13, color: C.textMuted, marginBottom: 4 },
    closedPollDate: { fontSize: 11, color: C.textMuted },

    // Modal
    modalContainer: { flex: 1, backgroundColor: C.surface },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
    modalCancel: { fontSize: 15, color: C.textSecondary },
    modalTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
    modalDone: { fontSize: 15, fontWeight: '700', color: C.primary },
    modalDoneDisabled: { opacity: 0.4 },
    modalSubtitle: { fontSize: 14, fontWeight: '600', color: C.textSecondary, paddingHorizontal: 16, marginBottom: 8 },
    modalSubCount: { fontWeight: '400', color: C.textMuted },

    questionInput: {
      margin: 16, marginBottom: 4, backgroundColor: C.background, borderWidth: 1, borderColor: C.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.textPrimary,
    },

    noFavs: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    noFavsText: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },

    favItem: { flexDirection: 'row', alignItems: 'center', padding: 12, marginHorizontal: 16, marginBottom: 8, backgroundColor: C.background, borderRadius: 12, borderWidth: 1, borderColor: C.border },
    favItemSelected: { borderColor: C.primary, backgroundColor: C.primaryLight },
    favPhoto: { width: 48, height: 48, borderRadius: 8, backgroundColor: C.border },
    favPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    favInfo: { flex: 1, marginHorizontal: 10 },
    favName: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
    favAddress: { fontSize: 12, color: C.textMuted },
    favRating: { fontSize: 12, color: C.textSecondary },
    favCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    favCheckSelected: { backgroundColor: C.primary, borderColor: C.primary },
  });
}

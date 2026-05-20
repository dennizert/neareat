import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  getUserProfile, getFriendRecommendations,
  getFriends, sendFriendRequest, removeFriend,
} from '../../services/social';
import { reportUser } from '../../services/messages';
import { useFriendStore } from '../../store/friendStore';
import type { UserProfile, Recommendation, Collection } from '../../types';
import StarRating from '../../components/StarRating';
import api from '../../services/api';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

export default function FriendProfileScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { userId } = route.params as { userId: string };
  const { friends, setFriends, addFriend, removeFriend: storeDel } = useFriendStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [sharedCollections, setSharedCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  // Şikayet modal
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const existingFriend = friends.find(f => f.profile.id === userId);
  const isFriend = !!existingFriend;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [p, recs, freshFriends] = await Promise.allSettled([
          getUserProfile(userId),
          getFriendRecommendations(userId),
          getFriends(),
        ]);
        if (freshFriends.status === 'fulfilled') setFriends(freshFriends.value);
        if (p.status === 'fulfilled' && p.value) setProfile(p.value);
        if (recs.status === 'fulfilled') setRecommendations(recs.value);
        if (p.status === 'rejected') {
          Alert.alert('Hata', 'Profil yüklenemedi.');
          navigation.goBack();
          return;
        }

        // Arkadaşsa paylaşılan listeleri de çek (freshFriends kullan)
        const currentFriends = freshFriends.status === 'fulfilled' ? freshFriends.value : friends;
        if (currentFriends.find(f => f.profile.id === userId)) {
          try {
            const colRes = await api.get(`/collections/shared-by/${userId}`);
            setSharedCollections(colRes.data ?? []);
          } catch {}
        }
      } catch {
        Alert.alert('Hata', 'Profil yüklenemedi.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  async function handleAddFriend() {
    if (!profile) return;
    setActionLoading(true);
    try {
      await sendFriendRequest(userId);
      setRequestSent(true);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error ?? '';
      if (status === 400 && msg.includes('arkadaş')) {
        Alert.alert('Zaten Arkadaşsınız', 'Bu kullanıcı arkadaş listenizde zaten var.');
        getFriends().then(list => setFriends(list)).catch(() => {});
      } else if (status === 409) {
        setRequestSent(true);
      } else {
        Alert.alert('Hata', 'İstek gönderilemedi.');
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveFriend() {
    if (!existingFriend) return;
    Alert.alert(
      'Arkadaşlıktan Çıkar',
      `${profile?.displayName} ile arkadaşlığı bitirmek istiyor musun?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkar', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            await removeFriend(existingFriend.id);
            storeDel(existingFriend.id);
            setActionLoading(false);
          },
        },
      ],
    );
  }

  async function handleReport() {
    if (!reportReason.trim()) {
      Alert.alert('Hata', 'Şikayet sebebi zorunludur.');
      return;
    }
    setReportLoading(true);
    try {
      await reportUser(userId, reportReason.trim());
      setReportVisible(false);
      setReportReason('');
      Alert.alert('Teşekkürler', 'Şikayetiniz alındı. Ekibimiz inceleyecektir.');
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.error || 'Şikayet gönderilemedi.');
    } finally {
      setReportLoading(false);
    }
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color={C.primary} />;
  }

  if (!profile) return null;

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {profile.photoUrl ? (
            <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>{profile.displayName.charAt(0)}</Text>
            </View>
          )}

          <Text style={styles.name}>{profile.displayName}</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.badge}>{profile.badgeIcon} {profile.badge}</Text>
          </View>
          {profile.city ? <Text style={styles.city}>📍 {profile.city}</Text> : null}

          <View style={styles.starRow}>
            <Text style={styles.starCount}>⭐ {profile.starCount} Yıldız</Text>
          </View>

          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

          {profile.favoriteCuisines.length > 0 && (
            <View style={styles.cuisineRow}>
              {profile.favoriteCuisines.map(c => (
                <View key={c} style={styles.cuisineChip}>
                  <Text style={styles.cuisineText}>{c}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action buttons */}
          {!isFriend && !requestSent && (
            <TouchableOpacity
              style={[styles.friendBtn, actionLoading && styles.friendBtnDisabled]}
              onPress={handleAddFriend}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.friendBtnText}>+ Arkadaş Ekle</Text>
              )}
            </TouchableOpacity>
          )}

          {requestSent && (
            <View style={styles.sentBadge}>
              <Text style={styles.sentBadgeText}>✓ Arkadaşlık isteği gönderildi</Text>
            </View>
          )}

          {isFriend && (
            <View style={styles.friendActionRow}>
              <TouchableOpacity
                style={styles.messageBtn}
                onPress={() => navigation.navigate('Conversation', {
                  userId,
                  displayName: profile.displayName,
                  photoUrl: profile.photoUrl,
                })}
              >
                <Text style={styles.messageBtnText}>💬 Mesaj Gönder</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.removeFriendBtn} onPress={handleRemoveFriend}>
                <Text style={styles.removeFriendText}>✓ Arkadaşsınız</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Şikayet */}
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => setReportVisible(true)}
          >
            <Text style={styles.reportBtnText}>⚠️ Şikayet Et</Text>
          </TouchableOpacity>
        </View>

        {/* Paylaşılan Listeler — sadece arkadaşsa */}
        {isFriend && sharedCollections.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Paylaşılan Listeler</Text>
            {sharedCollections.map(col => (
              <TouchableOpacity
                key={col.id}
                style={styles.collCard}
                onPress={() => navigation.navigate('CollectionDetail', { collectionId: col.id, title: col.name })}
              >
                <View style={styles.collIcon}>
                  <Text style={{ fontSize: 20 }}>📝</Text>
                </View>
                <View style={styles.collInfo}>
                  <Text style={styles.collName}>{col.name}</Text>
                  {col.description ? (
                    <Text style={styles.collDesc} numberOfLines={1}>{col.description}</Text>
                  ) : null}
                  <Text style={styles.collCount}>{col.itemCount} restoran</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Paylaşılan Öneriler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {profile.isPublic ? 'Paylaşılan Öneriler' : 'Öneriler'}
          </Text>
          {recommendations.length === 0 ? (
            <Text style={styles.emptyText}>
              {profile.isPublic
                ? 'Henüz paylaşılan öneri yok.'
                : 'Bu kullanıcının profili gizlidir.'}
            </Text>
          ) : (
            recommendations.map(rec => (
              <TouchableOpacity
                key={rec.id}
                style={styles.recCard}
                onPress={() => navigation.navigate('RestaurantDetail', { placeId: rec.restaurant.placeId })}
              >
                {rec.restaurant.photoUrl ? (
                  <Image source={{ uri: rec.restaurant.photoUrl }} style={styles.recPhoto} />
                ) : (
                  <View style={[styles.recPhoto, styles.recPhotoPlaceholder]}>
                    <Text style={{ fontSize: 24 }}>🍽️</Text>
                  </View>
                )}
                <View style={styles.recInfo}>
                  <Text style={styles.recName}>{rec.restaurant.name}</Text>
                  <StarRating rating={rec.restaurant.rating} size={12} />
                  {rec.message ? (
                    <Text style={styles.recMessage}>"{rec.message}"</Text>
                  ) : null}
                  <Text style={styles.recDate}>{timeAgo(rec.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Şikayet Modal */}
      <Modal visible={reportVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Kullanıcıyı Şikayet Et</Text>
            <Text style={styles.modalSub}>
              Şikayet sebebinizi açıklayın. Ekibimiz inceleyecektir.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Şikayet sebebini yazın... (zorunlu)"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={4}
              maxLength={1000}
            />
            <Text style={styles.charCount}>{reportReason.length}/1000</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setReportVisible(false); setReportReason(''); }}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalReportBtn, (!reportReason.trim() || reportLoading) && styles.modalBtnDisabled]}
                onPress={handleReport}
                disabled={!reportReason.trim() || reportLoading}
              >
                {reportLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalReportText}>Şikayet Et</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Bugün';
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  return `${Math.floor(days / 30)} ay önce`;
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: { alignItems: 'center', backgroundColor: C.surface, padding: 24, marginBottom: 12 },
    avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 12 },
    avatarPlaceholder: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    avatarLetter: { fontSize: 36, fontWeight: '700', color: C.primary },
    name: { fontSize: 22, fontWeight: '700', color: C.textPrimary, marginBottom: 6 },
    badgeRow: { marginBottom: 4 },
    badge: { fontSize: 14, color: C.primary, fontWeight: '600' },
    city: { fontSize: 13, color: C.textTertiary, marginBottom: 4 },
    starRow: { marginBottom: 12 },
    starCount: { fontSize: 14, color: C.warning, fontWeight: '600' },
    bio: {
      fontSize: 14, color: C.textSecondary, textAlign: 'center',
      lineHeight: 20, paddingHorizontal: 16, marginBottom: 12,
    },
    cuisineRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginBottom: 16 },
    cuisineChip: { backgroundColor: C.primaryLighter, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    cuisineText: { fontSize: 12, color: C.primary },
    friendBtn: {
      backgroundColor: C.primary, borderRadius: 12,
      paddingHorizontal: 32, paddingVertical: 12, marginBottom: 8,
    },
    friendBtnDisabled: { opacity: 0.6 },
    friendBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    sentBadge: { backgroundColor: '#D1FAE5', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 8 },
    sentBadgeText: { color: '#065F46', fontWeight: '600' },
    friendActionRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    messageBtn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
    messageBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    removeFriendBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
    removeFriendText: { color: C.textTertiary, fontWeight: '600', fontSize: 14 },
    reportBtn: { marginTop: 8, paddingVertical: 6 },
    reportBtnText: { fontSize: 12, color: C.error },

    section: { backgroundColor: C.surface, margin: 12, borderRadius: 16, padding: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 12 },
    emptyText: { fontSize: 13, color: C.textMuted, textAlign: 'center', paddingVertical: 12 },

    collCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, borderBottomWidth: 1, borderColor: C.separator, paddingBottom: 12 },
    collIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.primaryLighter, alignItems: 'center', justifyContent: 'center' },
    collInfo: { flex: 1 },
    collName: { fontSize: 14, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
    collDesc: { fontSize: 12, color: C.textTertiary, marginBottom: 2 },
    collCount: { fontSize: 11, color: C.textMuted },

    recCard: { flexDirection: 'row', marginBottom: 12, borderBottomWidth: 1, borderColor: C.separator, paddingBottom: 12 },
    recPhoto: { width: 64, height: 64, borderRadius: 10, marginRight: 12 },
    recPhotoPlaceholder: { backgroundColor: C.inputBg, alignItems: 'center', justifyContent: 'center' },
    recInfo: { flex: 1 },
    recName: { fontSize: 15, fontWeight: '700', color: C.textPrimary, marginBottom: 3 },
    recMessage: { fontSize: 13, color: C.textTertiary, fontStyle: 'italic', marginTop: 4, lineHeight: 18 },
    recDate: { fontSize: 11, color: C.textMuted, marginTop: 4 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, marginBottom: 6 },
    modalSub: { fontSize: 13, color: C.textTertiary, marginBottom: 16, lineHeight: 18 },
    modalInput: {
      backgroundColor: C.background, borderRadius: 12, borderWidth: 1, borderColor: C.border,
      padding: 12, fontSize: 14, color: C.textPrimary, minHeight: 100, textAlignVertical: 'top',
    },
    charCount: { fontSize: 11, color: C.textMuted, alignSelf: 'flex-end', marginTop: 4 },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
    modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    modalCancelText: { color: C.textTertiary, fontWeight: '600' },
    modalReportBtn: { flex: 1, backgroundColor: C.error, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    modalBtnDisabled: { opacity: 0.5 },
    modalReportText: { color: '#fff', fontWeight: '700' },
  });
}

import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Image, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useFavoriteStore } from '../store/favoriteStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useFriendStore } from '../store/friendStore';
import { useRecommendationStore } from '../store/recommendationStore';
import { signOut } from '../services/auth';
import {
  getMyProfile, getMyRecommendations, getReceivedRecommendations,
  getPendingRequests, getStarEvents,
} from '../services/social';
import api from '../services/api';
import type { Recommendation } from '../types';
import StarRating from '../components/StarRating';
import NotificationBell from '../components/NotificationBell';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, subscription, isPremium, clear } = useAuthStore();
  const { setFavorites } = useFavoriteStore();
  const { profile, starEvents, setProfile, clear: clearProfile } = useUserProfileStore();
  const { friends, pendingRequests, setFriends, setPendingRequests, clear: clearFriends } = useFriendStore();
  const {
    myRecommendations, receivedRecommendations,
    setMyRecommendations, setReceivedRecommendations, clear: clearRecs,
  } = useRecommendationStore();

  const [refreshing, setRefreshing] = useState(false);
  const [activeRecTab, setActiveRecTab] = useState<'received' | 'mine'>('received');
  const premium = isPremium();

  async function loadAll() {
    try {
      const [p, mine, received, reqs, events] = await Promise.all([
        getMyProfile(),
        getMyRecommendations(),
        getReceivedRecommendations(),
        getPendingRequests(),
        getStarEvents(),
      ]);
      setProfile(p);
      setMyRecommendations(mine);
      setReceivedRecommendations(received);
      setPendingRequests(reqs);
      // update star events in store (setProfile handles star count)
    } catch { /* swallow - offline tolerance */ }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  async function handleSignOut() {
    await signOut();
    clear();
    clearProfile();
    clearFriends();
    clearRecs();
    setFavorites([]);
  }

  async function handleDeleteAccount() {
    Alert.alert('Hesabı Sil', 'Tüm verileriniz silinecek. Devam etmek istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          await api.delete('/auth/account');
          await signOut();
          clear();
          clearProfile();
          clearFriends();
          clearRecs();
        },
      },
    ]);
  }

  const displayName = profile?.displayName ?? user?.displayName ?? '';
  const photoUrl = profile?.photoUrl ?? user?.photoUrl ?? null;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF6B35" />}
    >
      {/* Profile Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <NotificationBell />
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.editBtnText}>Düzenle</Text>
          </TouchableOpacity>
        </View>

        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>{displayName.charAt(0)}</Text>
          </View>
        )}

        <View style={styles.displayNameRow}>
          <Text style={styles.displayName}>{displayName}</Text>
          {premium && (
            <View style={styles.premiumRozet}>
              <Text style={styles.premiumRozetText}>⭐ Premium</Text>
            </View>
          )}
        </View>
        <Text style={styles.email}>{user?.email}</Text>

        {profile?.city ? (
          <Text style={styles.city}>📍 {profile.city}</Text>
        ) : null}

        {profile?.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}

        {profile && profile.favoriteCuisines.length > 0 && (
          <View style={styles.cuisineRow}>
            {profile.favoriteCuisines.map(c => (
              <View key={c} style={styles.cuisineChip}>
                <Text style={styles.cuisineText}>{c}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Stars & Badge */}
      {profile && (
        <TouchableOpacity
          style={styles.starsCard}
          onPress={() => navigation.navigate('Rewards')}
        >
          <View style={styles.starsLeft}>
            <Text style={styles.badgeIcon}>{profile.badgeIcon}</Text>
            <View>
              <Text style={styles.badgeName}>{profile.badge}</Text>
              <Text style={styles.badgeSub}>Seviye {profile.level}</Text>
            </View>
          </View>
          <View style={styles.starsRight}>
            <Text style={styles.starNum}>{profile.starCount}</Text>
            <Text style={styles.starLabel}>⭐ Yıldız</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('Friends')}
        >
          <Text style={styles.statNum}>{friends.length}</Text>
          <Text style={styles.statLabel}>Arkadaş</Text>
          {pendingRequests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{myRecommendations.length}</Text>
          <Text style={styles.statLabel}>Öneri</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{starEvents.length}</Text>
          <Text style={styles.statLabel}>Aktivite</Text>
        </View>
      </View>

      {/* Membership */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Üyelik</Text>
        <View style={styles.membershipRow}>
          <View style={[styles.statusBadge, premium ? styles.premiumBadge : styles.freeBadge]}>
            <Text style={styles.statusText}>{premium ? '⭐ Premium' : '🆓 Ücretsiz'}</Text>
          </View>
          {subscription?.expiresAt && (
            <Text style={styles.expiryText}>
              {premium ? 'Bitiş: ' : 'Süresi doldu: '}
              {new Date(subscription.expiresAt).toLocaleDateString('tr-TR')}
            </Text>
          )}
          {!premium && (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => navigation.navigate('Paywall', { trigger: 'onboarding' })}
            >
              <Text style={styles.upgradeBtnText}>Premium'a Geç →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Recommendations Tabs */}
      <View style={styles.recSection}>
        <View style={styles.recTabRow}>
          <TouchableOpacity
            style={[styles.recTab, activeRecTab === 'received' && styles.recTabActive]}
            onPress={() => setActiveRecTab('received')}
          >
            <Text style={[styles.recTabText, activeRecTab === 'received' && styles.recTabTextActive]}>
              Gelen Öneriler
              {receivedRecommendations.length > 0 ? ` (${receivedRecommendations.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.recTab, activeRecTab === 'mine' && styles.recTabActive]}
            onPress={() => setActiveRecTab('mine')}
          >
            <Text style={[styles.recTabText, activeRecTab === 'mine' && styles.recTabTextActive]}>
              Önerilerim
              {myRecommendations.length > 0 ? ` (${myRecommendations.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {activeRecTab === 'received' && (
          receivedRecommendations.length === 0
            ? <Text style={styles.emptyRec}>Arkadaşlarından gelen öneri yok.</Text>
            : receivedRecommendations.slice(0, 5).map(r => (
              <RecCard key={r.id} rec={r} onPress={() => navigation.navigate('RestaurantDetail', { placeId: r.restaurant.placeId })} />
            ))
        )}

        {activeRecTab === 'mine' && (
          myRecommendations.length === 0
            ? <Text style={styles.emptyRec}>Henüz öneri paylaşmadın. Restoran detayından paylaşabilirsin!</Text>
            : myRecommendations.slice(0, 5).map(r => (
              <RecCard key={r.id} rec={r} onPress={() => navigation.navigate('RestaurantDetail', { placeId: r.restaurant.placeId })} />
            ))
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <ActionRow label="👥 Arkadaşlar" onPress={() => navigation.navigate('Friends')} />
        <ActionRow label="⭐ Yıldızlarım & Ödüller" onPress={() => navigation.navigate('Rewards')} />
        <ActionRow label="✏️ Profili Düzenle" onPress={() => navigation.navigate('EditProfile')} />
        <ActionRow label="Çıkış Yap" onPress={handleSignOut} />
        <ActionRow label="Hesabı Sil" onPress={handleDeleteAccount} danger />
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function RecCard({ rec, onPress }: { rec: Recommendation; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.recCard} onPress={onPress}>
      {rec.restaurant.photoUrl ? (
        <Image source={{ uri: rec.restaurant.photoUrl }} style={styles.recPhoto} />
      ) : (
        <View style={[styles.recPhoto, styles.recPhotoPlaceholder]}>
          <Text style={{ fontSize: 20 }}>🍽️</Text>
        </View>
      )}
      <View style={styles.recCardInfo}>
        <Text style={styles.recCardName} numberOfLines={1}>{rec.restaurant.name}</Text>
        <StarRating rating={rec.restaurant.rating} size={11} />
        {rec.message ? (
          <Text style={styles.recCardMsg} numberOfLines={2}>"{rec.message}"</Text>
        ) : null}
        <Text style={styles.recCardFrom}>
          {rec.toUserId === null
            ? '🌍 Herkese açık'
            : rec.fromProfile?.displayName
              ? `👤 ${rec.fromProfile.displayName}`
              : '👤 Arkadaşına gönderildi'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ActionRow({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <Text style={[styles.actionText, danger && styles.actionDanger]}>{label}</Text>
      <Text style={styles.actionChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  headerCard: { backgroundColor: '#fff', alignItems: 'center', padding: 24, paddingTop: 52 },
  headerTopRow: { position: 'absolute', top: 52, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7 },
  editBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FFE8DF', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarLetter: { fontSize: 32, fontWeight: '700', color: '#FF6B35' },
  displayNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  displayName: { fontSize: 20, fontWeight: '700', color: '#111827' },
  premiumRozet: {
    backgroundColor: '#FFF7ED', borderRadius: 10, borderWidth: 1,
    borderColor: '#FED7AA', paddingHorizontal: 8, paddingVertical: 3,
  },
  premiumRozetText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  email: { fontSize: 13, color: '#9CA3AF', marginBottom: 4 },
  city: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  bio: { fontSize: 13, color: '#374151', textAlign: 'center', lineHeight: 18, paddingHorizontal: 16, marginTop: 4 },
  cuisineRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 },
  cuisineChip: { backgroundColor: '#FFF0EB', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  cuisineText: { fontSize: 11, color: '#FF6B35' },
  starsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', margin: 12, borderRadius: 16,
    padding: 16, marginBottom: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  starsLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  badgeIcon: { fontSize: 28 },
  badgeName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  badgeSub: { fontSize: 12, color: '#9CA3AF' },
  starsRight: { alignItems: 'flex-end', marginRight: 8 },
  starNum: { fontSize: 26, fontWeight: '800', color: '#FF6B35' },
  starLabel: { fontSize: 12, color: '#9CA3AF' },
  chevron: { fontSize: 22, color: '#9CA3AF' },
  statsRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    margin: 12, marginTop: 8, borderRadius: 16, padding: 16,
  },
  statItem: { flex: 1, alignItems: 'center', position: 'relative' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },
  badge: {
    position: 'absolute', top: -4, right: 8,
    backgroundColor: '#EF4444', borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1, minWidth: 16, alignItems: 'center',
  },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  section: { backgroundColor: '#fff', padding: 16, margin: 12, marginTop: 0, borderRadius: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginBottom: 10, textTransform: 'uppercase' },
  membershipRow: { gap: 8 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
  premiumBadge: { backgroundColor: '#FEF3C7' },
  freeBadge: { backgroundColor: '#F3F4F6' },
  statusText: { fontWeight: '600', color: '#111827' },
  expiryText: { fontSize: 12, color: '#9CA3AF' },
  upgradeBtn: { backgroundColor: '#FF6B35', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  upgradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  recSection: { backgroundColor: '#fff', margin: 12, borderRadius: 16, overflow: 'hidden' },
  recTabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#F3F4F6' },
  recTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  recTabActive: { borderBottomWidth: 2, borderColor: '#FF6B35' },
  recTabText: { fontSize: 13, color: '#9CA3AF' },
  recTabTextActive: { color: '#FF6B35', fontWeight: '700' },
  emptyRec: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20, lineHeight: 20 },
  recCard: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#F9FAFB' },
  recPhoto: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  recPhotoPlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  recCardInfo: { flex: 1 },
  recCardName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  recCardMsg: { fontSize: 12, color: '#6B7280', fontStyle: 'italic', marginTop: 3, lineHeight: 17 },
  recCardFrom: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  actionsSection: { backgroundColor: '#fff', margin: 12, borderRadius: 16, overflow: 'hidden' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderColor: '#F9FAFB',
  },
  actionText: { flex: 1, fontSize: 15, color: '#374151' },
  actionDanger: { color: '#EF4444' },
  actionChevron: { fontSize: 20, color: '#D1D5DB' },
});

import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Image, RefreshControl, Switch, InteractionManager,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useFavoriteStore } from '../store/favoriteStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useFriendStore } from '../store/friendStore';
import { useRecommendationStore } from '../store/recommendationStore';
import { signOut } from '../services/auth';
import {
  getMyProfile, getMyRecommendations, getReceivedRecommendations,
  getPendingRequests, getStarEvents, getFriends,
} from '../services/social';
import api from '../services/api';
import type { Recommendation } from '../types';
import StarRating from '../components/StarRating';
import NotificationBell from '../components/NotificationBell';
import { useTheme } from '../theme';
import type { Colors } from '../theme';
import { useThemeStore } from '../store/themeStore';
import { useRestaurantStore } from '../store/restaurantStore';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, subscription, isPremium, clear } = useAuthStore();
  const { setFavorites } = useFavoriteStore();
  const { profile, starEvents, setProfile, setStarEvents, clear: clearProfile } = useUserProfileStore();
  const { friends, pendingRequests, setFriends, setPendingRequests, clear: clearFriends } = useFriendStore();
  const {
    myRecommendations, receivedRecommendations,
    setMyRecommendations, setReceivedRecommendations, clear: clearRecs,
  } = useRecommendationStore();
  const { isDark: darkModeOn, toggle: toggleDarkMode } = useThemeStore();

  const [refreshing, setRefreshing] = useState(false);
  const [activeRecTab, setActiveRecTab] = useState<'received' | 'mine'>('received');
  const [shareTogglePending, setShareTogglePending] = useState(false);
  const lastFetchRef = useRef<number>(0);
  const premium = isPremium();

  /**
   * AI öneri arkadaş paylaşımı toggle (Sprint-1 Task #9).
   * Optimistic update: UI önce, sonra API. Hata olursa eski değere dön.
   */
  async function handleToggleShareRecommender(next: boolean) {
    if (shareTogglePending) return;
    const previous = !!profile?.shareWithFriendsRecommender;
    if (profile) {
      // Optimistic
      setProfile({ ...profile, shareWithFriendsRecommender: next });
    }
    setShareTogglePending(true);
    try {
      const { data } = await api.put('/profile/me', { shareWithFriendsRecommender: next });
      if (data) setProfile(data);
    } catch (err: any) {
      // Rollback
      if (profile) {
        setProfile({ ...profile, shareWithFriendsRecommender: previous });
      }
      Alert.alert(
        'Hata',
        'Tercih güncellenemedi. İnternet bağlantını kontrol et.',
      );
    } finally {
      setShareTogglePending(false);
    }
  }

  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  async function loadAll() {
    const [pRes, mineRes, receivedRes, reqsRes, eventsRes, friendsRes] = await Promise.allSettled([
      getMyProfile(),
      getMyRecommendations(),
      getReceivedRecommendations(),
      getPendingRequests(),
      getStarEvents(),
      getFriends(),
    ]);
    if (pRes.status === 'fulfilled') setProfile(pRes.value);
    if (mineRes.status === 'fulfilled') setMyRecommendations(mineRes.value);
    if (receivedRes.status === 'fulfilled') setReceivedRecommendations(receivedRes.value);
    if (reqsRes.status === 'fulfilled') setPendingRequests(reqsRes.value);
    if (eventsRes.status === 'fulfilled') setStarEvents(eventsRes.value);
    if (friendsRes.status === 'fulfilled') setFriends(friendsRes.value);
  }

  useFocusEffect(useCallback(() => {
    if (Date.now() - lastFetchRef.current > 30_000) {
      const task = InteractionManager.runAfterInteractions(() => {
        loadAll().then(() => { lastFetchRef.current = Date.now(); });
      });
      return () => task.cancel();
    }
  }, []));

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

  async function handleClearSearchHistory() {
    Alert.alert(
      'Arama Geçmişini Sil',
      'Tüm arama geçmişiniz silinecek. AI önerileri de bu sinyali kullanmayacak. Devam edilsin mi?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive',
          onPress: async () => {
            try {
              const deleted = await useRestaurantStore.getState().clearSearchHistory();
              Alert.alert('Silindi', `${deleted} kayıt silindi.`);
            } catch {
              Alert.alert('Hata', 'Geçmiş silinemedi.');
            }
          },
        },
      ],
    );
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} />}
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

      {/* Grup Yemek Planları */}
      <TouchableOpacity
        style={styles.menuRow}
        onPress={() => navigation.navigate('MealGroups')}
      >
        <Text style={styles.menuRowIcon}>🍽️</Text>
        <Text style={styles.menuRowLabel}>Grup Yemek Planları</Text>
        <Text style={styles.menuRowChevron}>›</Text>
      </TouchableOpacity>

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
              <RecCard key={r.id} rec={r} onPress={() => navigation.navigate('RestaurantDetail', { placeId: r.restaurant.placeId })} styles={styles} C={C} />
            ))
        )}

        {activeRecTab === 'mine' && (
          myRecommendations.length === 0
            ? <Text style={styles.emptyRec}>Henüz öneri paylaşmadın. Restoran detayından paylaşabilirsin!</Text>
            : myRecommendations.slice(0, 5).map(r => (
              <RecCard key={r.id} rec={r} onPress={() => navigation.navigate('RestaurantDetail', { placeId: r.restaurant.placeId })} styles={styles} C={C} />
            ))
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <ActionRow label="👥 Arkadaşlar" onPress={() => navigation.navigate('Friends')} styles={styles} />
        <ActionRow label="📅 Rezervasyonlarım" onPress={() => navigation.navigate('MyReservations')} styles={styles} />
        <ActionRow label="📖 Yemek Günlüğüm" onPress={() => navigation.navigate('Diary')} styles={styles} />
        <ActionRow label="🎁 Arkadaşını Davet Et" onPress={() => navigation.navigate('Referral')} styles={styles} />
        <ActionRow label="⭐ Yıldızlarım & Ödüller" onPress={() => navigation.navigate('Rewards')} styles={styles} />
        <ActionRow label="✏️ Profili Düzenle" onPress={() => navigation.navigate('EditProfile')} styles={styles} />

        {/* AI Öneri arkadaş paylaşımı opt-in (Sprint-1 Task #9) */}
        <View style={styles.aiShareRow}>
          <View style={styles.aiShareTextWrap}>
            <Text style={styles.actionText}>🤖 AI Öneri Paylaşımı</Text>
            <Text style={styles.aiShareSub}>
              Tercihlerimi arkadaşlarımın AI önerilerinde kullansın
            </Text>
            <Text style={styles.aiShareHint}>
              Sadece adın ve verdiğin yıldızlar anonim olarak paylaşılır.
            </Text>
          </View>
          <Switch
            value={!!profile?.shareWithFriendsRecommender}
            onValueChange={handleToggleShareRecommender}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor={'#fff'}
            disabled={shareTogglePending}
          />
        </View>

        {/* Dark Mode Toggle Row */}
        <View style={styles.actionRow}>
          <Text style={styles.actionText}>{darkModeOn ? '🌙 Karanlık Mod' : '☀️ Karanlık Mod'}</Text>
          <Switch
            value={darkModeOn}
            onValueChange={toggleDarkMode}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor={darkModeOn ? '#fff' : '#fff'}
          />
        </View>

        <ActionRow label="Arama Geçmişini Sil" onPress={handleClearSearchHistory} styles={styles} />
        <ActionRow label="Çıkış Yap" onPress={handleSignOut} styles={styles} />
        <ActionRow label="Hesabı Sil" onPress={handleDeleteAccount} danger styles={styles} />
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function RecCard({ rec, onPress, styles, C }: { rec: Recommendation; onPress: () => void; styles: ReturnType<typeof makeStyles>; C: Colors }) {
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

function ActionRow({ label, onPress, danger = false, styles }: { label: string; onPress: () => void; danger?: boolean; styles: ReturnType<typeof makeStyles> }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <Text style={[styles.actionText, danger && styles.actionDanger]}>{label}</Text>
      <Text style={styles.actionChevron}>›</Text>
    </TouchableOpacity>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    headerCard: { backgroundColor: C.surface, alignItems: 'center', padding: 24, paddingTop: 52 },
    headerTopRow: { position: 'absolute', top: 52, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
    editBtn: { backgroundColor: C.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7 },
    editBtnText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
    avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
    avatarPlaceholder: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    avatarLetter: { fontSize: 32, fontWeight: '700', color: C.primary },
    displayNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    displayName: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
    premiumRozet: {
      backgroundColor: C.warningSurface, borderRadius: 10, borderWidth: 1,
      borderColor: C.warning, paddingHorizontal: 8, paddingVertical: 3,
    },
    premiumRozetText: { fontSize: 11, fontWeight: '700', color: C.warning },
    email: { fontSize: 13, color: C.textMuted, marginBottom: 4 },
    city: { fontSize: 13, color: C.textTertiary, marginBottom: 4 },
    bio: { fontSize: 13, color: C.textSecondary, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16, marginTop: 4 },
    cuisineRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 },
    cuisineChip: { backgroundColor: C.primaryLighter, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    cuisineText: { fontSize: 11, color: C.primary },
    starsCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, margin: 12, borderRadius: 16,
      padding: 16, marginBottom: 0,
      shadowColor: C.shadow, shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    starsLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    badgeIcon: { fontSize: 28 },
    badgeName: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    badgeSub: { fontSize: 12, color: C.textMuted },
    starsRight: { alignItems: 'flex-end', marginRight: 8 },
    starNum: { fontSize: 26, fontWeight: '800', color: C.primary },
    starLabel: { fontSize: 12, color: C.textMuted },
    chevron: { fontSize: 22, color: C.textMuted },
    statsRow: {
      flexDirection: 'row', backgroundColor: C.surface,
      margin: 12, marginTop: 8, borderRadius: 16, padding: 16,
    },
    statItem: { flex: 1, alignItems: 'center', position: 'relative' },
    statNum: { fontSize: 22, fontWeight: '800', color: C.textPrimary },
    statLabel: { fontSize: 12, color: C.textMuted, marginTop: 2 },
    statDivider: { width: 1, backgroundColor: C.separator, marginVertical: 4 },
    badge: {
      position: 'absolute', top: -4, right: 8,
      backgroundColor: C.error, borderRadius: 8,
      paddingHorizontal: 5, paddingVertical: 1, minWidth: 16, alignItems: 'center',
    },
    badgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
    menuRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
      margin: 12, marginTop: 0, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    },
    menuRowIcon: { fontSize: 20, marginRight: 12 },
    menuRowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: C.textPrimary },
    menuRowChevron: { fontSize: 22, color: C.textMuted },
    section: { backgroundColor: C.surface, padding: 16, margin: 12, marginTop: 0, borderRadius: 16 },
    sectionLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, marginBottom: 10, textTransform: 'uppercase' },
    membershipRow: { gap: 8 },
    statusBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
    premiumBadge: { backgroundColor: C.warningSurface },
    freeBadge: { backgroundColor: C.inputBg },
    statusText: { fontWeight: '600', color: C.textPrimary },
    expiryText: { fontSize: 12, color: C.textMuted },
    upgradeBtn: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    upgradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    recSection: { backgroundColor: C.surface, margin: 12, borderRadius: 16, overflow: 'hidden' },
    recTabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: C.separator },
    recTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    recTabActive: { borderBottomWidth: 2, borderColor: C.primary },
    recTabText: { fontSize: 13, color: C.textMuted },
    recTabTextActive: { color: C.primary, fontWeight: '700' },
    emptyRec: { fontSize: 13, color: C.textMuted, textAlign: 'center', padding: 20, lineHeight: 20 },
    recCard: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: C.background },
    recPhoto: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
    recPhotoPlaceholder: { backgroundColor: C.inputBg, alignItems: 'center', justifyContent: 'center' },
    recCardInfo: { flex: 1 },
    recCardName: { fontSize: 14, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
    recCardMsg: { fontSize: 12, color: C.textTertiary, fontStyle: 'italic', marginTop: 3, lineHeight: 17 },
    recCardFrom: { fontSize: 11, color: C.textMuted, marginTop: 3 },
    actionsSection: { backgroundColor: C.surface, margin: 12, borderRadius: 16, overflow: 'hidden' },
    actionRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 16,
      borderBottomWidth: 1, borderColor: C.background,
    },
    actionText: { flex: 1, fontSize: 15, color: C.textSecondary },
    actionDanger: { color: C.error },
    actionChevron: { fontSize: 20, color: C.disabled },

    aiShareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderColor: C.background,
      gap: 12,
    },
    aiShareTextWrap: { flex: 1 },
    aiShareSub: {
      fontSize: 12,
      color: C.textTertiary,
      marginTop: 2,
      lineHeight: 16,
    },
    aiShareHint: {
      fontSize: 11,
      color: C.textMuted,
      marginTop: 4,
      fontStyle: 'italic',
    },
  });
}

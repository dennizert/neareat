import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, RefreshControl, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { getMyRestaurantProfile, getRestaurantStats } from '../../services/restaurantAccount';
import { getRestaurantReservations } from '../../services/reservations';
import { trialDaysLeft } from '../../utils/occupancyBand';
import NotificationBell from '../../components/NotificationBell';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import type { IconName } from '../../theme/icons';
import type { RestaurantProfile, RestaurantStats } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

const MENU_ITEMS: { icon: IconName; label: string; screen: string }[] = [
  { icon: 'clock', label: 'Çalışma Saatleri', screen: 'RestaurantHours' },
  { icon: 'menu', label: 'Menü Yönetimi', screen: 'RestaurantMenu' },
  { icon: 'message', label: 'Yorumlar & Cevaplar', screen: 'RestaurantReviews' },
  { icon: 'discount', label: 'İndirim Yönetimi', screen: 'RestaurantDiscount' },
  { icon: 'campaign', label: 'Anlık Kampanya', screen: 'RestaurantCampaign' },
  { icon: 'analytics', label: 'Analitik Panel', screen: 'RestaurantAnalytics' },
  { icon: 'reservation', label: 'Rezervasyonlar', screen: 'RestaurantReservations' },
  { icon: 'calendar', label: 'Doluluk Paneli', screen: 'RestaurantOccupancy' },
  { icon: 'restaurant', label: 'Restoran Bilgileri', screen: 'RestaurantInfo' },
];

export default function RestaurantDashboardScreen() {
  const navigation = useNavigation<any>();
  const { logout, subscription, loadSubscription } = useAuthStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [stats, setStats] = useState<RestaurantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pendingPopupShown = useRef(false);

  async function load(isRefresh = false) {
    try {
      const [p, s] = await Promise.all([getMyRestaurantProfile(), getRestaurantStats()]);
      setProfile(p);
      setStats(s);

      // Girişten sonra ilk açılışta bekleyen rezervasyon varsa bir kez bilgilendir
      if (!isRefresh && !pendingPopupShown.current) {
        pendingPopupShown.current = true;
        getRestaurantReservations('PENDING')
          .then((pending) => {
            if (pending.length > 0) {
              Alert.alert(
                '📅 Bekleyen Rezervasyon',
                `${pending.length} bekleyen rezervasyon isteğin var. Onaylamak veya reddetmek için görüntüle.`,
                [
                  { text: 'Daha Sonra', style: 'cancel' },
                  { text: 'Görüntüle', onPress: () => navigation.navigate('RestaurantReservations') },
                ],
              );
            }
          })
          .catch(() => { /* sessiz — bilgilendirme kritik değil */ });
      }
    } catch { /* swallow */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); loadSubscription(); }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />;

  // S19-5: trial sayacı — deneme süresindeki restorana kalan günü ve yenileme CTA'sını göster.
  const trialLeft = subscription?.status === 'trial' ? trialDaysLeft(subscription.expiresAt) : null;

  const now = new Date();
  const instantActive = profile?.discountActiveUntil && new Date(profile.discountActiveUntil) > now;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
    >
      {/* Ortak header — orta: restoranın Görünen Adı */}
      <AppHeader
        center={(
          <Text style={styles.headerName} numberOfLines={1}>
            {profile?.displayName ?? profile?.businessName}
          </Text>
        )}
        right={(
          <>
            <NotificationBell />
            <TouchableOpacity onPress={logout}>
              <Text style={styles.logoutText}>Çıkış</Text>
            </TouchableOpacity>
          </>
        )}
      />

      {/* Restoran kimlik kartı (eski header bilgileri) */}
      <View style={styles.identityCard}>
        {profile?.placePhotoUrl ? (
          <Image source={{ uri: profile.placePhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={{ fontSize: 26 }}>🍽️</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.businessName} numberOfLines={1}>{profile?.businessName}</Text>
          <Text style={styles.category}>{profile?.businessCategory}</Text>
          <Text style={styles.placeName} numberOfLines={1}>{profile?.placeName ?? 'Restoran seçilmedi'}</Text>
        </View>
      </View>

      {/* S19-5: Trial sayacı — deneme süresi banner'ı + yenileme */}
      {trialLeft != null && (
        <TouchableOpacity style={styles.trialBanner} onPress={() => navigation.navigate('Paywall', { trigger: 'reservations' })}>
          <Text style={styles.trialBannerText}>
            {trialLeft > 0
              ? `⏳ Ücretsiz deneme: ${trialLeft} gün kaldı — 1.299,90 ₺/ay ile devam et`
              : '⏳ Deneme süren doldu — aboneliğini başlat (1.299,90 ₺/ay)'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Active discount banner */}
      {instantActive && (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerText}>
            ⚡ Anlık indirim aktif — %{profile!.discountPercent} · {new Date(profile!.discountActiveUntil!).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} kadar
          </Text>
        </View>
      )}

      {/* Announcement banner */}
      {profile?.announcementActive && profile.announcement && (
        <View style={styles.announcementBanner}>
          <Text style={styles.announcementText}>📢 {profile.announcement}</Text>
        </View>
      )}

      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <StatCard icon="❤️" value={stats.favorites} label="Favori" styles={styles} />
          <StatCard icon="⭐" value={stats.avgRating ?? '—'} label="Ort. Puan" styles={styles} />
          <StatCard icon="💬" value={stats.reviews} label="Yorum" styles={styles} />
          <StatCard icon="📤" value={stats.recommendations} label="Öneri" styles={styles} />
        </View>
      )}

      {/* Menu grid */}
      <Text style={styles.sectionTitle}>Yönetim</Text>
      <View style={styles.menuGrid}>
        {MENU_ITEMS.map(item => (
          <TouchableOpacity
            key={item.screen}
            style={styles.menuCard}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.8}
          >
            <AppIcon name={item.icon} size={26} color={C.primary} style={styles.menuCardIcon} />
            <Text style={styles.menuCardLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick info */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>İşletme Bilgileri</Text>
        <TouchableOpacity onPress={() => navigation.navigate('RestaurantInfo')}>
          <Text style={styles.editLink}>Düzenle ›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.infoCard}>
        <InfoRow label="Telefon" value={profile?.phone ?? '—'} styles={styles} />
        <InfoRow label="E-posta" value={profile?.contactEmail ?? '—'} styles={styles} />
        <InfoRow label="Adres" value={profile?.address ?? '—'} styles={styles} />
        <InfoRow label="Rezervasyon" value={profile?.reservationUrl ?? 'Eklenmedi'} styles={styles} />
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, value, label, styles }: { icon: string; value: string | number; label: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    headerName: { fontSize: 16, fontWeight: '800', color: C.textPrimary },
    identityCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 16,
    },
    avatar: { width: 56, height: 56, borderRadius: 12, marginRight: 12 },
    avatarPlaceholder: { backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    businessName: { fontSize: 17, fontWeight: '800', color: C.textPrimary },
    category: { fontSize: 12, color: C.textTertiary, marginTop: 1 },
    placeName: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
    logoutText: { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
    activeBanner: { backgroundColor: C.successSurface, padding: 12, alignItems: 'center' },
    activeBannerText: { color: C.success, fontWeight: '700', fontSize: 13 },
    announcementBanner: { backgroundColor: C.amberSurface, padding: 12 },
    announcementText: { color: C.amber, fontSize: 13, lineHeight: 18, fontWeight: '600' },
    trialBanner: { backgroundColor: C.warningSurface, padding: 12 },
    trialBannerText: { color: C.warning, fontSize: 13, lineHeight: 18, fontWeight: '700' },
    statsRow: { flexDirection: 'row', padding: 16, gap: 10 },
    statCard: {
      flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 12,
      alignItems: 'center', shadowColor: C.shadow, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    statIcon: { fontSize: 20, marginBottom: 4 },
    statValue: { fontSize: 16, fontWeight: '800', color: C.textPrimary },
    statLabel: { fontSize: 11, color: C.textMuted, marginTop: 2 },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10, marginTop: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: C.textSecondary, paddingHorizontal: 16, marginBottom: 10, marginTop: 8 },
    editLink: { fontSize: 13, color: C.primary, fontWeight: '600' },
    menuGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10, marginBottom: 16 },
    menuCard: {
      width: '47%', backgroundColor: C.surface, borderRadius: 16, padding: 20,
      alignItems: 'center', shadowColor: C.shadow, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    menuCardIcon: { marginBottom: 8 },
    menuCardLabel: { fontSize: 13, fontWeight: '700', color: C.textSecondary, textAlign: 'center' },
    infoCard: { backgroundColor: C.surface, borderRadius: 14, marginHorizontal: 16, padding: 4, shadowColor: C.shadow, shadowOpacity: 0.04, elevation: 1 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.separator },
    infoLabel: { fontSize: 13, color: C.textTertiary, fontWeight: '600', width: 90 },
    infoValue: { fontSize: 13, color: C.textPrimary, flex: 1, textAlign: 'right' },
  });
}

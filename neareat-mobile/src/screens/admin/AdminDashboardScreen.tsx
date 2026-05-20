import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Alert, ScrollView, Modal, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { getPlatformStats, getPendingRestaurants, getReports, handleReport, suspendUser } from '../../services/admin';
import type { AdminStats, AdminRestaurantSummary, UserReport } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

type Tab = 'pending' | 'approved' | 'rejected' | 'reports' | 'stats';

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { logout } = useAuthStore();
  const { C, isDark } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [tab, setTab] = useState<Tab>('pending');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [restaurants, setRestaurants] = useState<AdminRestaurantSummary[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Report action modal
  const [reportModal, setReportModal] = useState<UserReport | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function load(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      if (tab === 'reports') {
        const [s, r] = await Promise.all([getPlatformStats(), getReports('PENDING')]);
        setStats(s);
        setReports(r.reports);
      } else if (tab !== 'stats') {
        const [s, r] = await Promise.all([
          getPlatformStats(),
          getPendingRestaurants(tab.toUpperCase()),
        ]);
        setStats(s);
        setRestaurants(r.profiles);
      } else {
        const s = await getPlatformStats();
        setStats(s);
      }
    } catch { } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [tab]);

  async function doHandleReport(action: 'suspend' | 'dismiss' | 'warn') {
    if (!reportModal) return;
    setActionLoading(true);
    try {
      await handleReport(reportModal.id, action, actionNote || undefined);
      setReportModal(null);
      setActionNote('');
      setReports(prev => prev.filter(r => r.id !== reportModal.id));
      Alert.alert('Başarılı', 'İşlem tamamlandı.');
    } catch {
      Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
    } finally {
      setActionLoading(false);
    }
  }

  const statusColor: Record<string, string> = {
    PENDING: C.warning, APPROVED: '#22C55E', REJECTED: C.error,
  };

  const statusLabel: Record<string, string> = {
    PENDING: 'Bekliyor', APPROVED: 'Onaylı', REJECTED: 'Reddedildi',
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />;

  return (
    <View style={styles.container}>
      {/* Header — intentionally dark in both modes */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Paneli</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('AdminLogs')}>
            <Text style={styles.logoutText}>Loglar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logoutText}>Çıkış</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {(['pending', 'approved', 'rejected', 'reports', 'stats'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'pending' ? `Bekleyenler ${stats ? `(${stats.pendingRestaurants})` : ''}` :
               t === 'approved' ? 'Onaylılar' :
               t === 'rejected' ? 'Reddedilenler' :
               t === 'reports' ? `Şikayetler${reports.length > 0 ? ` (${reports.length})` : ''}` :
               'İstatistikler'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === 'reports' && (
        <FlatList
          data={reports}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Bekleyen şikayet yok.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => { setReportModal(item); setActionNote(''); }}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>⚠️ Şikayet</Text>
                <View style={[styles.statusBadge, { backgroundColor: C.errorSurface }]}>
                  <Text style={[styles.statusBadgeText, { color: C.error }]}>Bekliyor</Text>
                </View>
              </View>
              <Text style={styles.cardOwner}>
                Şikayet Eden: <Text style={{ fontWeight: '700' }}>{item.reporter.displayName}</Text>
              </Text>
              <Text style={styles.cardOwner}>
                Şikayet Edilen: <Text style={{ fontWeight: '700', color: C.error }}>{item.reported.displayName}</Text>
                {item.reported.isSuspended ? ' (Askıya Alındı)' : ''}
              </Text>
              <Text style={styles.cardPhone} numberOfLines={2}>{item.reason}</Text>
              <Text style={styles.cardDate}>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {tab === 'stats' && stats ? (
        <ScrollView contentContainerStyle={styles.statsBody}>
          <StatGroupComponent title="Kullanıcılar" styles={styles}>
            <StatRowComponent label="Toplam Kullanıcı" value={stats.totalUsers} styles={styles} />
            <StatRowComponent label="Bugün Giriş Yapan" value={stats.activeUsersToday} styles={styles} />
            <StatRowComponent label="Bugün Yeni Kayıt" value={stats.newUsersToday} styles={styles} />
            <StatRowComponent label="Aktif Premium" value={stats.activePremium} styles={styles} />
          </StatGroupComponent>
          <StatGroupComponent title="Restoranlar" styles={styles}>
            <StatRowComponent label="Toplam Başvuru" value={stats.totalRestaurants} styles={styles} />
            <StatRowComponent label="Onaylı" value={stats.approvedRestaurants} styles={styles} />
            <StatRowComponent label="Bekleyen" value={stats.pendingRestaurants} styles={styles} />
            <StatRowComponent label="Bugün Giriş Yapan" value={stats.activeRestaurantsToday} styles={styles} />
            <StatRowComponent label="Bugün Yeni Başvuru" value={stats.newRestaurantsToday} styles={styles} />
          </StatGroupComponent>
          <StatGroupComponent title="İçerik" styles={styles}>
            <StatRowComponent label="Toplam Yorum" value={stats.totalReviews} styles={styles} />
            <StatRowComponent label="Toplam Favori" value={stats.totalFavorites} styles={styles} />
            <StatRowComponent label="Toplam Öneri" value={stats.totalRecommendations} styles={styles} />
          </StatGroupComponent>
        </ScrollView>
      ) : tab !== 'reports' ? (
        <FlatList
          data={restaurants}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Bu kategoride kayıt yok.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('AdminRestaurantDetail', { restaurantId: item.id })}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{item.businessName}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor[item.status] + '22' }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor[item.status] }]}>
                    {statusLabel[item.status]}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardOwner}>{item.ownerName} · {item.businessCategory}</Text>
              <Text style={styles.cardPhone}>{item.phone}</Text>
              <Text style={styles.cardDate}>Başvuru: {new Date(item.createdAt).toLocaleDateString('tr-TR')}</Text>
            </TouchableOpacity>
          )}
        />
      ) : null}

      {/* Şikayet İşlem Modal */}
      <Modal visible={!!reportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Şikayet İşlemi</Text>
            {reportModal && (
              <>
                <Text style={styles.modalReportedName}>
                  Şikayet Edilen: <Text style={{ color: C.error, fontWeight: '700' }}>{reportModal.reported.displayName}</Text>
                </Text>
                <Text style={styles.modalReportReason} numberOfLines={4}>{reportModal.reason}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={actionNote}
                  onChangeText={setActionNote}
                  placeholder="İşlem notu (opsiyonel)..."
                  placeholderTextColor={C.textMuted}
                  multiline
                  maxLength={500}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: C.error }]}
                    onPress={() => doHandleReport('suspend')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.modalActionText}>Askıya Al</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: C.warning }]}
                    onPress={() => doHandleReport('warn')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.modalActionText}>Uyar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: C.textTertiary }]}
                    onPress={() => doHandleReport('dismiss')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.modalActionText}>Reddet</Text>
                  </TouchableOpacity>
                </View>
                {actionLoading && <ActivityIndicator style={{ marginTop: 12 }} color={C.primary} />}
              </>
            )}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => { setReportModal(null); setActionNote(''); }}
            >
              <Text style={styles.modalCloseText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatGroupComponent({ title, children, styles }: { title: string; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.statGroup}>
      <Text style={styles.statGroupTitle}>{title}</Text>
      <View style={styles.statGroupCard}>{children}</View>
    </View>
  );
}

function StatRowComponent({ label, value, styles }: { label: string; value: number; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value.toLocaleString('tr-TR')}</Text>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#111827',
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
    logoutText: { fontSize: 13, color: C.textMuted, fontWeight: '600' },
    tabScroll: { backgroundColor: C.surface, maxHeight: 48 },
    tabRow: { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
    tab: { paddingHorizontal: 14, paddingVertical: 12 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: C.primary },
    tabText: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
    tabTextActive: { color: C.primary, fontWeight: '700' },
    list: { padding: 16, paddingBottom: 32 },
    card: {
      backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10,
      shadowColor: C.shadow, shadowOpacity: 0.05, elevation: 2,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    cardName: { fontSize: 15, fontWeight: '700', color: C.textPrimary, flex: 1 },
    statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },
    cardOwner: { fontSize: 12, color: C.textTertiary, marginBottom: 2 },
    cardPhone: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
    cardDate: { fontSize: 11, color: C.textMuted, marginTop: 4 },
    empty: { paddingTop: 60, alignItems: 'center' },
    emptyText: { fontSize: 14, color: C.textMuted },
    statsBody: { padding: 16, paddingBottom: 40, gap: 16 },
    statGroup: {},
    statGroupTitle: { fontSize: 14, fontWeight: '700', color: C.textSecondary, marginBottom: 8 },
    statGroupCard: { backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden', shadowColor: C.shadow, shadowOpacity: 0.04, elevation: 1 },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.separator },
    statLabel: { fontSize: 14, color: C.textSecondary },
    statValue: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, marginBottom: 12 },
    modalReportedName: { fontSize: 14, color: C.textSecondary, marginBottom: 8 },
    modalReportReason: { fontSize: 13, color: C.textTertiary, backgroundColor: C.background, padding: 12, borderRadius: 10, marginBottom: 12, lineHeight: 18 },
    modalInput: { backgroundColor: C.background, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 10, fontSize: 13, color: C.textPrimary, minHeight: 60, textAlignVertical: 'top', marginBottom: 12 },
    modalActions: { flexDirection: 'row', gap: 8 },
    modalActionBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    modalActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    modalClose: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
    modalCloseText: { color: C.textMuted, fontWeight: '600' },
  });
}

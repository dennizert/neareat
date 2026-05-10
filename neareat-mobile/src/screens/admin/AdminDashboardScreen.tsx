import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Alert, ScrollView, Modal, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { getPlatformStats, getPendingRestaurants, getReports, handleReport, suspendUser } from '../../services/admin';
import type { AdminStats, AdminRestaurantSummary, UserReport } from '../../types';

type Tab = 'pending' | 'approved' | 'rejected' | 'reports' | 'stats';

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { logout } = useAuthStore();
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
    PENDING: '#F59E0B', APPROVED: '#22C55E', REJECTED: '#EF4444',
  };

  const statusLabel: Record<string, string> = {
    PENDING: 'Bekliyor', APPROVED: 'Onaylı', REJECTED: 'Reddedildi',
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#FF6B35" size="large" />;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Paneli</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Çıkış</Text>
        </TouchableOpacity>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor="#FF6B35" />}
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
                <View style={[styles.statusBadge, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#EF4444' }]}>Bekliyor</Text>
                </View>
              </View>
              <Text style={styles.cardOwner}>
                Şikayet Eden: <Text style={{ fontWeight: '700' }}>{item.reporter.displayName}</Text>
              </Text>
              <Text style={styles.cardOwner}>
                Şikayet Edilen: <Text style={{ fontWeight: '700', color: '#EF4444' }}>{item.reported.displayName}</Text>
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
          <StatGroup title="Kullanıcılar">
            <StatRow label="Toplam Kullanıcı" value={stats.totalUsers} />
            <StatRow label="Bugün Giriş Yapan" value={stats.activeUsersToday} />
            <StatRow label="Bugün Yeni Kayıt" value={stats.newUsersToday} />
            <StatRow label="Aktif Premium" value={stats.activePremium} />
          </StatGroup>
          <StatGroup title="Restoranlar">
            <StatRow label="Toplam Başvuru" value={stats.totalRestaurants} />
            <StatRow label="Onaylı" value={stats.approvedRestaurants} />
            <StatRow label="Bekleyen" value={stats.pendingRestaurants} />
            <StatRow label="Bugün Giriş Yapan" value={stats.activeRestaurantsToday} />
            <StatRow label="Bugün Yeni Başvuru" value={stats.newRestaurantsToday} />
          </StatGroup>
          <StatGroup title="İçerik">
            <StatRow label="Toplam Yorum" value={stats.totalReviews} />
            <StatRow label="Toplam Favori" value={stats.totalFavorites} />
            <StatRow label="Toplam Öneri" value={stats.totalRecommendations} />
          </StatGroup>
        </ScrollView>
      ) : tab !== 'reports' ? (
        <FlatList
          data={restaurants}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor="#FF6B35" />}
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
                  Şikayet Edilen: <Text style={{ color: '#EF4444', fontWeight: '700' }}>{reportModal.reported.displayName}</Text>
                </Text>
                <Text style={styles.modalReportReason} numberOfLines={4}>{reportModal.reason}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={actionNote}
                  onChangeText={setActionNote}
                  placeholder="İşlem notu (opsiyonel)..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={500}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: '#EF4444' }]}
                    onPress={() => doHandleReport('suspend')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.modalActionText}>Askıya Al</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: '#F59E0B' }]}
                    onPress={() => doHandleReport('warn')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.modalActionText}>Uyar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: '#6B7280' }]}
                    onPress={() => doHandleReport('dismiss')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.modalActionText}>Reddet</Text>
                  </TouchableOpacity>
                </View>
                {actionLoading && <ActivityIndicator style={{ marginTop: 12 }} color="#FF6B35" />}
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

function StatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.statGroup}>
      <Text style={styles.statGroupTitle}>{title}</Text>
      <View style={styles.statGroupCard}>{children}</View>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value.toLocaleString('tr-TR')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#111827',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  logoutText: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
  tabScroll: { backgroundColor: '#fff', maxHeight: 48 },
  tabRow: { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
  tab: { paddingHorizontal: 14, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#FF6B35' },
  tabText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  tabTextActive: { color: '#FF6B35', fontWeight: '700' },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  cardOwner: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  cardPhone: { fontSize: 13, color: '#374151', fontWeight: '500' },
  cardDate: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  statsBody: { padding: 16, paddingBottom: 40, gap: 16 },
  statGroup: {},
  statGroupTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  statGroupCard: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, elevation: 1 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  statLabel: { fontSize: 14, color: '#374151' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  modalReportedName: { fontSize: 14, color: '#374151', marginBottom: 8 },
  modalReportReason: { fontSize: 13, color: '#6B7280', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, marginBottom: 12, lineHeight: 18 },
  modalInput: { backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, fontSize: 13, color: '#111827', minHeight: 60, textAlignVertical: 'top', marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalActionBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modalClose: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  modalCloseText: { color: '#9CA3AF', fontWeight: '600' },
});

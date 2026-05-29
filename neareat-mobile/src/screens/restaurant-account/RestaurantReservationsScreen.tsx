import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  getRestaurantReservations,
  updateReservationStatus,
  markAttendance,
} from '../../services/reservations';
import type { Reservation } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

type TabKey = string | undefined | 'TODAY';

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: undefined, label: 'Tümü' },
  { key: 'TODAY', label: 'Bugün' },
  { key: 'PENDING', label: 'Bekliyor' },
  { key: 'CONFIRMED', label: 'Onaylı' },
  { key: 'COMPLETED', label: 'Tamamlandı' },
];

function getStatusLabels(C: Colors): Record<string, { label: string; color: string; bg: string }> {
  return {
    PENDING:   { label: 'Bekliyor',   color: C.warning,       bg: C.warningSurface },
    CONFIRMED: { label: 'Onaylandı',  color: C.success,       bg: C.successSurface },
    REJECTED:  { label: 'Reddedildi', color: C.error,         bg: C.errorSurface },
    CANCELLED: { label: 'İptal',      color: C.textSecondary, bg: C.surfaceAlt },
    COMPLETED: { label: 'Tamamlandı', color: C.travel,        bg: C.travelSurface },
  };
}

export default function RestaurantReservationsScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [selectedTab, setSelectedTab] = useState<TabKey>(undefined);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      let data: Reservation[];
      if (selectedTab === 'TODAY') {
        data = await getRestaurantReservations('CONFIRMED', getTodayString());
      } else {
        data = await getRestaurantReservations(selectedTab as string | undefined);
      }
      setReservations(data);
    } catch { /* swallow */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, [selectedTab]));

  function handleTabChange(key: TabKey) {
    setSelectedTab(key);
  }

  function handleConfirm(id: string) {
    Alert.alert('Rezervasyonu Onayla', 'Bu rezervasyonu onaylamak istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Onayla',
        onPress: async () => {
          try {
            const updated = await updateReservationStatus(id, 'CONFIRMED');
            setReservations(prev => prev.map(r => r.id === id ? updated : r));
          } catch (err: any) {
            Alert.alert('Hata', err.response?.data?.error ?? 'Onaylanamadı.');
          }
        },
      },
    ]);
  }

  function handleReject(id: string) {
    Alert.prompt(
      'Rezervasyonu Reddet',
      'Lütfen red nedenini girin (zorunlu):',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Reddet',
          style: 'destructive',
          onPress: async (reason?: string) => {
            if (!reason?.trim()) {
              Alert.alert('Hata', 'Red nedeni girilmesi zorunludur.');
              return;
            }
            try {
              const updated = await updateReservationStatus(id, 'REJECTED', reason.trim());
              setReservations(prev => prev.map(r => r.id === id ? updated : r));
            } catch (err: any) {
              Alert.alert('Hata', err.response?.data?.error ?? 'Reddedilemedi.');
            }
          },
        },
      ],
      'plain-text',
    );
  }

  function handleMarkAttendance(id: string, attended: boolean) {
    const msg = attended ? 'Müşteri geldi olarak işaretlensin mi?' : 'Müşteri gelmedi olarak işaretlensin mi?';
    Alert.alert('Katılım Durumu', msg, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Onayla',
        onPress: async () => {
          try {
            const updated = await markAttendance(id, attended);
            setReservations(prev => prev.map(r => r.id === id ? updated : r));
          } catch (err: any) {
            Alert.alert('Hata', err.response?.data?.error ?? 'İşaretlenemedi.');
          }
        },
      },
    ]);
  }

  function renderTodayItem({ item }: { item: Reservation; index: number }) {
    return (
      <TouchableOpacity
        style={styles.todayRow}
        onPress={() => navigation.navigate('ReservationDetail', { reservationId: item.id })}
        activeOpacity={0.8}
      >
        <View style={styles.todayTimeBox}>
          <Text style={styles.todayTime}>{item.time}</Text>
        </View>
        <View style={styles.todayInfo}>
          <Text style={styles.todayGuestName}>{item.user.displayName}</Text>
          <Text style={styles.todayGuests}>👥 {item.guestCount} kişi{item.occasion ? `  •  ${item.occasion}` : ''}</Text>
          {item.specialRequests ? <Text style={styles.todaySpecial} numberOfLines={1}>📝 {item.specialRequests}</Text> : null}
        </View>
        {item.attended === null && (
          <View style={styles.todayActions}>
            <TouchableOpacity style={styles.attendedBtnSm} onPress={() => handleMarkAttendance(item.id, true)}>
              <Text style={styles.attendedBtnSmText}>Geldi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.noShowBtnSm} onPress={() => handleMarkAttendance(item.id, false)}>
              <Text style={styles.noShowBtnSmText}>Gelmedi</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.attended === true && <Text style={styles.attendedMark}>✅</Text>}
        {item.attended === false && <Text style={styles.noShowMark}>⚠️</Text>}
      </TouchableOpacity>
    );
  }

  const STATUS_LABELS = React.useMemo(() => getStatusLabels(C), [C]);

  function renderItem({ item }: { item: Reservation }) {
    const st = STATUS_LABELS[item.status] ?? STATUS_LABELS.PENDING;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.guestName}>{item.user.displayName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.dateTime}>📅 {item.date}   🕐 {item.time}   👥 {item.guestCount} kişi</Text>
        {item.occasion ? <Text style={styles.occasion}>🎉 {item.occasion}</Text> : null}
        {item.specialRequests ? <Text style={styles.special}>📝 {item.specialRequests}</Text> : null}
        {item.status === 'REJECTED' && item.rejectionReason && (
          <Text style={styles.rejectionText}>Red: {item.rejectionReason}</Text>
        )}
        {item.attended === true && <Text style={styles.attendedText}>✅ Müşteri geldi</Text>}
        {item.attended === false && <Text style={styles.noShowText}>⚠️ Müşteri gelmedi</Text>}

        {/* Aksiyon Butonları */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.msgBtn}
            onPress={() => navigation.navigate('ReservationDetail', { reservationId: item.id })}
          >
            <Text style={styles.msgBtnText}>💬 Mesaj</Text>
          </TouchableOpacity>

          {item.status === 'PENDING' && (
            <>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => handleConfirm(item.id)}>
                <Text style={styles.confirmBtnText}>✓ Onayla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
                <Text style={styles.rejectBtnText}>✗ Reddet</Text>
              </TouchableOpacity>
            </>
          )}

          {item.status === 'CONFIRMED' && item.attended === null && (
            <>
              <TouchableOpacity style={styles.attendedBtn} onPress={() => handleMarkAttendance(item.id, true)}>
                <Text style={styles.attendedBtnText}>Geldi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.noShowBtn} onPress={() => handleMarkAttendance(item.id, false)}>
                <Text style={styles.noShowBtnText}>Gelmedi</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {TABS.map(t => (
          <TouchableOpacity
            key={String(t.key)}
            style={[styles.tab, selectedTab === t.key && styles.tabActive]}
            onPress={() => handleTabChange(t.key)}
          >
            <Text style={[styles.tabText, selectedTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading
        ? <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />
        : selectedTab === 'TODAY'
          ? (
            <>
              <View style={styles.todayHeader}>
                <Text style={styles.todayHeaderText}>
                  {getTodayString()} — Onaylanan Rezervasyonlar
                </Text>
                <Text style={styles.todayCount}>{reservations.length} rezervasyon</Text>
              </View>
              <FlatList
                data={[...reservations].sort((a, b) => a.time.localeCompare(b.time))}
                keyExtractor={r => r.id}
                renderItem={renderTodayItem}
                contentContainerStyle={reservations.length === 0 ? styles.empty : { paddingHorizontal: 16, paddingVertical: 8 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
                ListEmptyComponent={
                  <View style={styles.emptyContent}>
                    <Text style={styles.emptyIcon}>☀️</Text>
                    <Text style={styles.emptyTitle}>Bugün onaylı rezervasyon yok</Text>
                  </View>
                }
              />
            </>
          )
          : (
            <FlatList
              data={reservations}
              keyExtractor={r => r.id}
              renderItem={renderItem}
              contentContainerStyle={reservations.length === 0 ? styles.empty : { padding: 16 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
              ListEmptyComponent={
                <View style={styles.emptyContent}>
                  <Text style={styles.emptyIcon}>📅</Text>
                  <Text style={styles.emptyTitle}>Bu kategoride rezervasyon yok</Text>
                </View>
              }
            />
          )
      }
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    tabBar: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.separator, flexGrow: 0 },
    tab: {
      paddingHorizontal: 16, paddingVertical: 12, marginRight: 4, borderRadius: 0,
      borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: C.primary },
    tabText: { fontSize: 14, color: C.textTertiary, fontWeight: '500' },
    tabTextActive: { color: C.primary, fontWeight: '700' },
    card: {
      backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12,
      shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    guestName: { fontSize: 15, fontWeight: '700', color: C.textPrimary, flex: 1, marginRight: 8 },
    statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
    statusText: { fontSize: 12, fontWeight: '600' },
    dateTime: { fontSize: 13, color: C.textSecondary, marginBottom: 3 },
    occasion: { fontSize: 13, color: C.textTertiary, marginBottom: 2 },
    special: { fontSize: 12, color: C.textTertiary, fontStyle: 'italic', marginBottom: 2 },
    rejectionText: { fontSize: 12, color: C.error, marginBottom: 2 },
    attendedText: { fontSize: 12, color: C.success, fontWeight: '600', marginTop: 4 },
    noShowText: { fontSize: 12, color: C.error, fontWeight: '600', marginTop: 4 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    msgBtn: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
      backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
    },
    msgBtnText: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
    confirmBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.successSurface },
    confirmBtnText: { fontSize: 13, color: C.success, fontWeight: '700' },
    rejectBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.errorSurface },
    rejectBtnText: { fontSize: 13, color: C.error, fontWeight: '700' },
    attendedBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.successSurface },
    attendedBtnText: { fontSize: 13, color: C.success, fontWeight: '700' },
    noShowBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.errorSurface },
    noShowBtnText: { fontSize: 13, color: C.error, fontWeight: '700' },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContent: { alignItems: 'center', padding: 40 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { fontSize: 16, color: C.textTertiary, fontWeight: '600' },
    // Bugün sekmesi
    todayHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
      backgroundColor: C.primaryLighter, borderBottomWidth: 1, borderBottomColor: C.primaryLight,
    },
    todayHeaderText: { fontSize: 13, fontWeight: '700', color: C.primary },
    todayCount: { fontSize: 13, color: C.textTertiary },
    todayRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12,
      marginBottom: 8, padding: 12, gap: 12,
      shadowColor: C.shadow, shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    todayTimeBox: {
      width: 56, height: 56, borderRadius: 10, backgroundColor: C.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    todayTime: { fontSize: 15, fontWeight: '700', color: C.primaryOn },
    todayInfo: { flex: 1 },
    todayGuestName: { fontSize: 15, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
    todayGuests: { fontSize: 13, color: C.textSecondary, marginBottom: 1 },
    todaySpecial: { fontSize: 12, color: C.textTertiary, fontStyle: 'italic' },
    todayActions: { gap: 4 },
    attendedBtnSm: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: C.successSurface,
    },
    attendedBtnSmText: { fontSize: 11, color: C.success, fontWeight: '700' },
    noShowBtnSm: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: C.errorSurface,
    },
    noShowBtnSmText: { fontSize: 11, color: C.error, fontWeight: '700' },
    attendedMark: { fontSize: 22 },
    noShowMark: { fontSize: 22 },
  });
}

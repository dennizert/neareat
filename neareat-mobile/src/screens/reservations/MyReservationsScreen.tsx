import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getMyReservations, cancelReservation } from '../../services/reservations';
import type { Reservation } from '../../types';
import { reservationRestaurantName } from '../../utils/reservationName';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

function getStatusLabels(C: Colors): Record<string, { label: string; color: string; bg: string }> {
  return {
    PENDING:   { label: 'Bekliyor',   color: C.warning,        bg: C.warningSurface },
    CONFIRMED: { label: 'Onaylandı',  color: C.success,        bg: C.successSurface },
    REJECTED:  { label: 'Reddedildi', color: C.error,          bg: C.errorSurface },
    CANCELLED: { label: 'İptal',      color: C.textSecondary,  bg: C.surfaceAlt },
    COMPLETED: { label: 'Tamamlandı', color: C.travel,         bg: C.travelSurface },
  };
}

export default function MyReservationsScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      const data = await getMyReservations();
      setReservations(data);
    } catch { /* swallow */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleCancel(id: string) {
    Alert.alert('Rezervasyonu İptal Et', 'Bu rezervasyonu iptal etmek istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'İptal Et',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelReservation(id);
            setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'CANCELLED' } : r));
          } catch (err: any) {
            Alert.alert('Hata', err.response?.data?.error ?? 'İptal edilemedi.');
          }
        },
      },
    ]);
  }

  const STATUS_LABELS = React.useMemo(() => getStatusLabels(C), [C]);

  function renderItem({ item }: { item: Reservation }) {
    const st = STATUS_LABELS[item.status] ?? STATUS_LABELS.PENDING;
    const canModify = ['PENDING', 'CONFIRMED'].includes(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ReservationDetail', { reservationId: item.id })}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <Text style={styles.restaurantName} numberOfLines={1}>{reservationRestaurantName(item)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.dateTime}>📅 {item.date}  🕐 {item.time}</Text>
        <Text style={styles.guests}>👥 {item.guestCount} kişi{item.occasion ? `  •  ${item.occasion}` : ''}</Text>
        {item.status === 'REJECTED' && item.rejectionReason && (
          <Text style={styles.rejection}>Red nedeni: {item.rejectionReason}</Text>
        )}
        {item.attended === true && <Text style={styles.attendedBadge}>✅ Katıldınız (+20 yıldız)</Text>}
        {item.attended === false && <Text style={styles.noShowBadge}>⚠️ Katılmadınız (-10 yıldız)</Text>}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => navigation.navigate('ReservationDetail', { reservationId: item.id })}
          >
            <Text style={styles.detailBtnText}>Detay & Mesaj</Text>
          </TouchableOpacity>
          {canModify && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('EditReservation', { reservationId: item.id })}
            >
              <Text style={styles.editBtnText}>Güncelle</Text>
            </TouchableOpacity>
          )}
          {canModify && (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id)}>
              <Text style={styles.cancelBtnText}>İptal Et</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={reservations}
        keyExtractor={r => r.id}
        renderItem={renderItem}
        contentContainerStyle={reservations.length === 0 ? styles.empty : { padding: 16, paddingBottom: bottom + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>Henüz rezervasyonunuz yok</Text>
            <Text style={styles.emptySubtitle}>Restoran detay sayfasından rezervasyon yapabilirsiniz.</Text>
          </View>
        }
      />
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    card: {
      backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12,
      shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    restaurantName: { fontSize: 15, fontWeight: '700', color: C.textPrimary, flex: 1, marginRight: 8 },
    statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
    statusText: { fontSize: 12, fontWeight: '600' },
    dateTime: { fontSize: 13, color: C.textSecondary, marginBottom: 3 },
    guests: { fontSize: 13, color: C.textTertiary, marginBottom: 4 },
    rejection: { fontSize: 12, color: C.error, fontStyle: 'italic', marginBottom: 4 },
    attendedBadge: { fontSize: 12, color: C.success, fontWeight: '600', marginBottom: 4 },
    noShowBadge: { fontSize: 12, color: C.error, fontWeight: '600', marginBottom: 4 },
    cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    detailBtn: {
      flex: 1, backgroundColor: C.primaryLight, borderRadius: 8, paddingVertical: 8, alignItems: 'center',
      borderWidth: 1, borderColor: C.primary,
    },
    detailBtnText: { fontSize: 13, color: C.primaryText, fontWeight: '600' },
    editBtn: {
      flex: 1, backgroundColor: C.surfaceAlt, borderRadius: 8, paddingVertical: 8, alignItems: 'center',
      borderWidth: 1, borderColor: C.border,
    },
    editBtnText: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
    cancelBtn: {
      flex: 1, backgroundColor: C.errorSurface, borderRadius: 8, paddingVertical: 8, alignItems: 'center',
      borderWidth: 1, borderColor: C.error,
    },
    cancelBtnText: { fontSize: 13, color: C.error, fontWeight: '600' },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContent: { alignItems: 'center', padding: 32 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary, marginBottom: 8 },
    emptySubtitle: { fontSize: 14, color: C.textTertiary, textAlign: 'center' },
  });
}

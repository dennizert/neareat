/**
 * RestaurantOccupancyScreen — Restoran KOLTUK doluluk paneli (S19-5).
 * Seçilen gün için saat bazlı doluluk (dolu/boş koltuk + bant: Müsait/Az yer kaldı/Dolu).
 * Koltuk kapasitesi tanımlı değilse uyarı gösterir. SUBSCRIPTION_REQUIRED → premium akışı.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOccupancy } from '../../services/reservations';
import type { OccupancyResponse } from '../../services/reservations';
import { isPremiumRequired, handleRestaurantPremiumError } from '../../utils/premiumGate';
import { bandLabel, bandColorKey } from '../../utils/occupancyBand';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}
function formatTr(iso: string): string {
  try { return new Date(iso + 'T00:00:00Z').toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' }); }
  catch { return iso; }
}

export default function RestaurantOccupancyScreen() {
  const navigation = useNavigation<any>();
  const { bottom } = useSafeAreaInsets();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [date, setDate] = useState(isoDate(new Date()));
  const [data, setData] = useState<OccupancyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subRequired, setSubRequired] = useState(false);

  const load = useCallback(async (d: string) => {
    try {
      setSubRequired(false);
      const res = await getOccupancy(d);
      setData(res);
    } catch (err: any) {
      if (isPremiumRequired(err)) { setSubRequired(true); setData(null); return; }
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(date); }, [date, load]);

  function colorFor(band: string): string {
    const key = bandColorKey(band);
    return key === 'success' ? C.success : key === 'warning' ? C.warning : key === 'danger' ? C.error : C.textMuted;
  }

  if (subRequired) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyTitle}>Aktif abonelik gerekli</Text>
        <Text style={styles.emptyText}>Doluluk paneli aktif restoran aboneliği gerektirir.</Text>
        <TouchableOpacity style={styles.upgradeBtn} onPress={() => handleRestaurantPremiumError({ response: { data: { code: 'SUBSCRIPTION_REQUIRED' } } }, { trigger: 'reservations' })}>
          <Text style={styles.upgradeBtnText}>Aboneliği Yenile →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(date); }} tintColor={C.primary} />}
    >
      {/* Tarih seçici */}
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setDate(addDays(date, -1))}>
          <Text style={styles.dateBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateLabel}>{formatTr(date)}</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setDate(addDays(date, 1))}>
          <Text style={styles.dateBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : data?.seatCapacity == null ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Koltuk kapasitesi tanımlı değil</Text>
          <Text style={styles.emptyText}>Doluluk hesabı için Restoran Bilgileri'nden koltuk kapasitesini girin.</Text>
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => navigation.navigate('RestaurantInfo')}>
            <Text style={styles.upgradeBtnText}>Restoran Bilgileri →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
          <Text style={styles.capacityHint}>Toplam koltuk: {data.seatCapacity}</Text>
          {data.slots.map((s) => (
            <View key={s.time} style={styles.slotRow}>
              <Text style={styles.slotTime}>{s.time}</Text>
              <View style={styles.slotBar}>
                <View style={[styles.slotFill, { width: `${Math.min(100, s.percent ?? 0)}%`, backgroundColor: colorFor(s.band) }]} />
              </View>
              <View style={styles.slotMeta}>
                <Text style={[styles.slotBand, { color: colorFor(s.band) }]}>{bandLabel(s.band) ?? '—'}</Text>
                <Text style={styles.slotSeats}>{s.reserved}/{data.seatCapacity}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.separator },
    dateBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.inputBg, alignItems: 'center', justifyContent: 'center' },
    dateBtnText: { fontSize: 22, color: C.primary, fontWeight: '700' },
    dateLabel: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    list: { padding: 16, gap: 10 },
    capacityHint: { fontSize: 13, color: C.textMuted, marginBottom: 4 },
    slotRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    slotTime: { width: 48, fontSize: 13, fontWeight: '600', color: C.textSecondary },
    slotBar: { flex: 1, height: 14, borderRadius: 7, backgroundColor: C.inputBg, overflow: 'hidden' },
    slotFill: { height: 14, borderRadius: 7 },
    slotMeta: { width: 92, alignItems: 'flex-end' },
    slotBand: { fontSize: 12, fontWeight: '700' },
    slotSeats: { fontSize: 11, color: C.textMuted },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, textAlign: 'center' },
    emptyText: { fontSize: 13, color: C.textMuted, textAlign: 'center' },
    upgradeBtn: { marginTop: 12, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
    upgradeBtnText: { color: '#fff', fontWeight: '700' },
  });
}

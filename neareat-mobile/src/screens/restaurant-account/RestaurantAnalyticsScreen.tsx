/**
 * RestaurantAnalyticsScreen — Restoran analitik paneli (Sprint-5 Task #7).
 * S5-5 metrikleri (trend, yoğun saat, durum dağılımı, katılım, puan) +
 * S5-6 Claude haftalık işletme raporu.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { getRestaurantAnalytics, getWeeklyReport } from '../../services/restaurantAccount';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import type { RestaurantAnalytics, WeeklyReport } from '../../types';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekleyen',
  CONFIRMED: 'Onaylı',
  REJECTED: 'Reddedilen',
  CANCELLED: 'İptal',
  COMPLETED: 'Tamamlanan',
};

export default function RestaurantAnalyticsScreen() {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

  const [analytics, setAnalytics] = useState<RestaurantAnalytics | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    // Rapor başarısız olsa da metrikler gösterilsin (allSettled)
    const [aRes, rRes] = await Promise.allSettled([getRestaurantAnalytics(), getWeeklyReport()]);
    if (aRes.status === 'fulfilled') {
      setAnalytics(aRes.value);
    } else {
      setError('Analitik veriler yüklenemedi.');
    }
    setReport(rRes.status === 'fulfilled' ? rRes.value : null);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (error && !analytics) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>⚠️</Text>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }

  const r = analytics!.reservations;
  const rev = analytics!.reviews;
  const maxTrend = Math.max(1, ...r.trend.map((t) => t.count));
  const maxHour = Math.max(1, ...r.busiestHours.map((h) => h.count));
  const maxDist = Math.max(1, ...Object.values(rev.distribution));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: bottom + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
    >
      {/* AI haftalık rapor */}
      {report && (
        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>🤖 Haftalık İşletme Raporu</Text>
          <Text style={styles.reportText}>{report.report}</Text>
          {report.fallback && (
            <Text style={styles.reportFallback}>AI özet şu an kullanılamadı, otomatik özet gösteriliyor.</Text>
          )}
        </View>
      )}

      {/* Özet kutular */}
      <View style={styles.statRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{r.totalReservations}</Text>
          <Text style={styles.statLabel}>Toplam rezervasyon</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {r.attendanceRate != null ? `%${Math.round(r.attendanceRate * 100)}` : '—'}
          </Text>
          <Text style={styles.statLabel}>Katılım oranı</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{rev.avgRating != null ? rev.avgRating : '—'}</Text>
          <Text style={styles.statLabel}>Ort. puan ({rev.reviewCount})</Text>
        </View>
      </View>

      {/* 7 günlük trend */}
      <Text style={styles.sectionTitle}>Son 7 gün rezervasyon</Text>
      <View style={styles.card}>
        {r.trend.map((t) => (
          <BarRow key={t.date} label={t.date.slice(5)} value={t.count} max={maxTrend} C={C} styles={styles} />
        ))}
      </View>

      {/* En yoğun saatler */}
      <Text style={styles.sectionTitle}>En yoğun saatler</Text>
      <View style={styles.card}>
        {r.busiestHours.length === 0 ? (
          <Text style={styles.muted}>Henüz veri yok.</Text>
        ) : (
          r.busiestHours.map((h) => (
            <BarRow key={h.hour} label={`${h.hour}:00`} value={h.count} max={maxHour} C={C} styles={styles} />
          ))
        )}
      </View>

      {/* Durum dağılımı */}
      <Text style={styles.sectionTitle}>Rezervasyon durumları</Text>
      <View style={styles.card}>
        {Object.entries(r.statusBreakdown).map(([k, v]) => (
          <View key={k} style={styles.statusRow}>
            <Text style={styles.statusLabel}>{STATUS_LABELS[k] ?? k}</Text>
            <Text style={styles.statusValue}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Puan dağılımı */}
      <Text style={styles.sectionTitle}>Puan dağılımı</Text>
      <View style={styles.card}>
        {[5, 4, 3, 2, 1].map((star) => (
          <BarRow
            key={star}
            label={`${star}★`}
            value={rev.distribution[star as 1 | 2 | 3 | 4 | 5]}
            max={maxDist}
            C={C}
            styles={styles}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function BarRow({ label, value, max, C, styles }: { label: string; value: number; max: number; C: Colors; styles: any }) {
  const pct = Math.round((value / max) * 100);
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(2, pct)}%` }]} />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { padding: 16, paddingBottom: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center' },

    reportCard: {
      backgroundColor: C.surfaceAlt,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: C.ai ?? C.primary,
    },
    reportTitle: { fontSize: 15, fontWeight: '800', color: C.textPrimary, marginBottom: 8 },
    reportText: { fontSize: 14, color: C.textSecondary, lineHeight: 21 },
    reportFallback: { fontSize: 11, color: C.textMuted, marginTop: 8, fontStyle: 'italic' },

    statRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statBox: {
      flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 12, alignItems: 'center',
      borderWidth: 1, borderColor: C.border,
    },
    statValue: { fontSize: 22, fontWeight: '800', color: C.primary },
    statLabel: { fontSize: 11, color: C.textTertiary, marginTop: 4, textAlign: 'center' },

    sectionTitle: { fontSize: 14, fontWeight: '700', color: C.textSecondary, marginBottom: 8, marginTop: 4 },
    card: {
      backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 18,
      borderWidth: 1, borderColor: C.border,
    },
    muted: { fontSize: 13, color: C.textMuted },

    barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    barLabel: { width: 48, fontSize: 12, color: C.textTertiary },
    barTrack: { flex: 1, height: 10, backgroundColor: C.surfaceAlt, borderRadius: 5, overflow: 'hidden', marginHorizontal: 8 },
    barFill: { height: 10, backgroundColor: C.primary, borderRadius: 5 },
    barValue: { width: 28, fontSize: 12, fontWeight: '700', color: C.textSecondary, textAlign: 'right' },

    statusRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    statusLabel: { fontSize: 13, color: C.textSecondary },
    statusValue: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  });
}

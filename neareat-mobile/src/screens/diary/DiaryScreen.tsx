/**
 * DiaryScreen — kişisel yemek günlüğü (Sprint-7 #93).
 * Üstte stats kartları, altında entry listesi. Sadece kullanıcının kendisi görür.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  listDiaryEntries, getDiaryStats, deleteDiaryEntry,
  type DiaryEntry, type DiaryStats,
} from '../../services/diary';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

const MONTH_NAMES_TR = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
];

function formatMonth(ym: string) {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES_TR[parseInt(m) - 1]} ${y.slice(2)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_NAMES_TR[d.getMonth()]} ${d.getFullYear()}`;
}

export default function DiaryScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [stats, setStats] = useState<DiaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([listDiaryEntries(), getDiaryStats()]);
      setEntries(list.items);
      setStats(s);
    } catch {
      // sessiz — boş state ile gösterilir
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleDelete(id: string) {
    Alert.alert('Sil', 'Bu günlük kaydı silinsin mi?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDiaryEntry(id);
            setEntries((prev) => prev.filter((e) => e.id !== id));
            await load(); // stats'i de tazele
          } catch {
            Alert.alert('Hata', 'Silinemedi.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={C.primary} size="large" /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={entries.length === 0 ? styles.emptyContainer : [styles.list, { paddingBottom: bottom + 16 }]}
      data={entries}
      keyExtractor={(e) => e.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={C.primary}
        />
      }
      ListHeaderComponent={stats && stats.totalEntries > 0 ? (
        <View style={styles.statsBlock}>
          <Text style={styles.statsTitle}>Sen ve Yemek</Text>
          <View style={styles.statsRow}>
            <StatTile label="Ziyaret" value={String(stats.totalEntries)} styles={styles} />
            <StatTile label="Mekan" value={String(stats.uniquePlaces)} styles={styles} />
            <StatTile label="Ay" value={String(stats.monthlyCount.length)} styles={styles} />
          </View>
          {stats.topCuisineTags.length > 0 && (
            <>
              <Text style={styles.statsSubTitle}>En sevdiğin mutfaklar</Text>
              <View style={styles.chipRow}>
                {stats.topCuisineTags.map((t) => (
                  <View key={t.tag} style={styles.chip}>
                    <Text style={styles.chipText}>{t.tag} · {t.count}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {stats.topPlaces.length > 0 && (
            <>
              <Text style={styles.statsSubTitle}>Çok gittiğin mekanlar</Text>
              {stats.topPlaces.slice(0, 3).map((p) => (
                <Text key={p.placeId} style={styles.topPlace}>
                  • {p.placeName} <Text style={styles.topPlaceCount}>({p.count} kez)</Text>
                </Text>
              ))}
            </>
          )}
        </View>
      ) : null}
      ListEmptyComponent={(
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.emptyTitle}>Günlüğün boş</Text>
          <Text style={styles.emptyText}>
            Bir restorana gittiğinde detay sayfasından "Günlüğe ekle" diyebilirsin. Sadece sen görürsün.
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.entry}
          onPress={() => navigation.navigate('RestaurantDetail', { placeId: item.placeId })}
          onLongPress={() => handleDelete(item.id)}
          activeOpacity={0.85}
        >
          {item.placePhotoUrl ? (
            <Image source={{ uri: item.placePhotoUrl }} style={styles.entryPhoto} />
          ) : (
            <View style={[styles.entryPhoto, styles.entryPhotoFallback]}>
              <Text style={styles.entryPhotoEmoji}>🍽️</Text>
            </View>
          )}
          <View style={styles.entryBody}>
            <Text style={styles.entryName} numberOfLines={1}>{item.placeName}</Text>
            <Text style={styles.entryDate}>{formatDate(item.visitedAt)}</Text>
            {item.note && <Text style={styles.entryNote} numberOfLines={2}>{item.note}</Text>}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

function StatTile({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    list: { padding: 12 },
    emptyContainer: { flexGrow: 1, justifyContent: 'center' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

    statsBlock: {
      backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: C.border,
    },
    statsTitle: { fontSize: 16, fontWeight: '800', color: C.textPrimary, marginBottom: 12 },
    statsSubTitle: { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', marginTop: 12, marginBottom: 6, letterSpacing: 0.5 },
    statsRow: { flexDirection: 'row', gap: 10 },
    statTile: {
      flex: 1, alignItems: 'center', backgroundColor: C.background,
      borderRadius: 10, paddingVertical: 12,
    },
    statValue: { fontSize: 22, fontWeight: '800', color: C.primary },
    statLabel: { fontSize: 11, color: C.textMuted, marginTop: 2 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { backgroundColor: C.primaryLighter, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
    chipText: { fontSize: 12, color: C.primary, fontWeight: '600' },
    topPlace: { fontSize: 13, color: C.textSecondary, marginVertical: 2 },
    topPlaceCount: { color: C.textMuted },

    entry: {
      flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14,
      marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border,
    },
    entryPhoto: { width: 80, height: 80 },
    entryPhotoFallback: { backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
    entryPhotoEmoji: { fontSize: 28 },
    entryBody: { flex: 1, padding: 12, justifyContent: 'center' },
    entryName: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    entryDate: { fontSize: 12, color: C.travel, fontWeight: '600', marginTop: 2 },
    entryNote: { fontSize: 12, color: C.textTertiary, marginTop: 4, fontStyle: 'italic' },

    emptyEmoji: { fontSize: 56, marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, marginBottom: 8 },
    emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  });
}

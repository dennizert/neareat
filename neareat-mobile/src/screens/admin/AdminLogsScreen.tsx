import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getLogs } from '../../services/admin';
import type { UserLog } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

const PAGE_SIZE = 50;

interface Filters {
  email: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FILTERS: Filters = {
  email: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function AdminLogsScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [logs, setLogs] = useState<UserLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  const fetch = useCallback(async (f: Filters, p: number, replace: boolean) => {
    try {
      const params: Record<string, string | number> = { page: p, limit: PAGE_SIZE };
      if (f.email.trim()) params.email = f.email.trim();
      if (f.startDate.trim()) params.startDate = f.startDate.trim();
      if (f.endDate.trim()) params.endDate = f.endDate.trim();
      if (f.startTime.trim()) params.startTime = f.startTime.trim();
      if (f.endTime.trim()) params.endTime = f.endTime.trim();

      const res = await getLogs(params as any);
      setTotal(res.total);
      setLogs(prev => replace ? res.logs : [...prev, ...res.logs]);
      setHasLoaded(true);
    } catch {
      Alert.alert('Hata', 'Loglar yüklenemedi.');
    }
  }, []);

  async function applyFilters() {
    setLoading(true);
    setPage(1);
    setAppliedFilters(filters);
    await fetch(filters, 1, true);
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    setPage(1);
    await fetch(appliedFilters, 1, true);
    setRefreshing(false);
  }

  async function loadMore() {
    if (loadingMore || logs.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    setPage(nextPage);
    await fetch(appliedFilters, nextPage, false);
    setLoadingMore(false);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setLogs([]);
    setTotal(0);
    setPage(1);
    setHasLoaded(false);
  }

  function renderLog({ item }: { item: UserLog }) {
    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <Text style={styles.logAction}>{item.action}</Text>
          <Text style={styles.logDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <View style={styles.logMeta}>
          <Ionicons name="person-outline" size={12} color={C.textTertiary} />
          <Text style={styles.logMetaText}>
            {item.username || '—'} · {item.email || '—'}
          </Text>
        </View>
        <View style={styles.logMeta}>
          <Ionicons name="layers-outline" size={12} color={C.textTertiary} />
          <Text style={styles.logMetaText}>{item.page}</Text>
          {item.ip ? (
            <>
              <Text style={styles.logMetaDot}>·</Text>
              <Ionicons name="globe-outline" size={12} color={C.textTertiary} />
              <Text style={styles.logMetaText}>{item.ip}</Text>
            </>
          ) : null}
        </View>
        {item.details ? (
          <View style={styles.logMeta}>
            <Ionicons name="information-circle-outline" size={12} color={C.textTertiary} />
            <Text style={styles.logMetaText} numberOfLines={2}>{item.details}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header — intentionally dark in both modes */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kullanıcı Aktivite Logları</Text>
      </View>

      {/* Filter Panel */}
      <View style={styles.filterPanel}>
        <Text style={styles.filterTitle}>Filtrele</Text>

        <TextInput
          style={styles.input}
          placeholder="E-posta ara..."
          placeholderTextColor={C.textMuted}
          value={filters.email}
          onChangeText={v => setFilters(f => ({ ...f, email: v }))}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Başlangıç tarihi (YYYY-MM-DD)"
            placeholderTextColor={C.textMuted}
            value={filters.startDate}
            onChangeText={v => setFilters(f => ({ ...f, startDate: v }))}
          />
          <View style={styles.rowSpacer} />
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Saat (HH:MM)"
            placeholderTextColor={C.textMuted}
            value={filters.startTime}
            onChangeText={v => setFilters(f => ({ ...f, startTime: v }))}
          />
        </View>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Bitiş tarihi (YYYY-MM-DD)"
            placeholderTextColor={C.textMuted}
            value={filters.endDate}
            onChangeText={v => setFilters(f => ({ ...f, endDate: v }))}
          />
          <View style={styles.rowSpacer} />
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="Saat (HH:MM)"
            placeholderTextColor={C.textMuted}
            value={filters.endTime}
            onChangeText={v => setFilters(f => ({ ...f, endTime: v }))}
          />
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.flex1]} onPress={applyFilters} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnText}>Filtrele</Text>
            )}
          </TouchableOpacity>
          <View style={styles.rowSpacer} />
          <TouchableOpacity style={[styles.btnOutline, styles.flex1]} onPress={resetFilters}>
            <Text style={styles.btnOutlineText}>Sıfırla</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Results count */}
      {hasLoaded && (
        <View style={styles.countBar}>
          <Text style={styles.countText}>
            {total} kayıt bulundu · Sayfa {page}/{Math.ceil(total / PAGE_SIZE) || 1}
          </Text>
        </View>
      )}

      {/* Log List */}
      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        renderItem={renderLog}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          hasLoaded ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={C.disabled} />
              <Text style={styles.emptyText}>Kayıt bulunamadı</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={C.disabled} />
              <Text style={styles.emptyText}>Filtreleri uygulayarak logları görüntüleyin</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={C.primary} style={{ margin: 16 }} />
          ) : null
        }
        contentContainerStyle={logs.length === 0 ? styles.emptyFill : styles.listContent}
      />
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    // Admin paneli kasıtlı koyu — her iki modda da "sistem konsolu" hissi
    header: {
      backgroundColor: '#1F1A24',
      paddingTop: Platform.OS === 'ios' ? 54 : 40,
      paddingBottom: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backBtn: { padding: 4 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },

    filterPanel: {
      backgroundColor: C.surface,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      gap: 8,
    },
    filterTitle: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: C.disabled,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      color: C.textPrimary,
      backgroundColor: C.background,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowSpacer: { width: 8 },
    flex1: { flex: 1 },

    btn: {
      backgroundColor: C.primary,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    btnOutline: {
      borderWidth: 1,
      borderColor: C.disabled,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      backgroundColor: C.surface,
    },
    btnOutlineText: { color: C.textSecondary, fontWeight: '600', fontSize: 14 },

    countBar: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: C.primaryLight,
      borderBottomWidth: 1,
      borderBottomColor: C.primaryLighter,
    },
    countText: { fontSize: 12, color: C.primary, fontWeight: '500' },

    listContent: { padding: 12, gap: 8 },
    emptyFill: { flex: 1 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { color: C.textMuted, fontSize: 14, textAlign: 'center' },

    logCard: {
      backgroundColor: C.surface,
      borderRadius: 10,
      padding: 12,
      gap: 4,
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      marginBottom: 8,
    },
    logHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 4,
    },
    logAction: { fontSize: 14, fontWeight: '700', color: C.textPrimary, flex: 1 },
    logDate: { fontSize: 11, color: C.textTertiary, flexShrink: 0 },
    logMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    logMetaText: { fontSize: 12, color: C.textTertiary, flex: 1 },
    logMetaDot: { color: C.textMuted, marginHorizontal: 2 },
  });
}

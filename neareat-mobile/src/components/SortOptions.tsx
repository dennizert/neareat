import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRestaurantStore } from '../store/restaurantStore';
import type { SortOption } from '../types';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

const OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'distance',         label: 'Mesafe' },
  { key: 'rating',           label: 'Puan' },
  { key: 'userRatingsTotal', label: 'Oy Sayısı' },
];

export default function SortOptions() {
  const { sortBy, setSortBy } = useRestaurantStore();

  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {OPTIONS.map((opt, i) => (
        <TouchableOpacity
          key={opt.key}
          style={[
            styles.chip,
            sortBy === opt.key && styles.chipActive,
            i < OPTIONS.length - 1 && { marginRight: 8 },
          ]}
          onPress={() => setSortBy(opt.key)}
        >
          <Text style={[styles.chipText, sortBy === opt.key && styles.chipTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    scroll: { backgroundColor: C.surface },
    row: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
    chip: {
      height: 34,
      paddingHorizontal: 16,
      borderRadius: 17,
      borderWidth: 1.5,
      borderColor: C.disabled,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chipActive: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: C.textSecondary, lineHeight: 18 },
    chipTextActive: { color: '#fff' },
  });
}

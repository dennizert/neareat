import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRestaurantStore } from '../store/restaurantStore';
import type { SortOption } from '../types';

const OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'distance',         label: 'Mesafe' },
  { key: 'rating',           label: 'Puan' },
  { key: 'userRatingsTotal', label: 'Oy Sayısı' },
];

export default function SortOptions() {
  const { sortBy, setSortBy } = useRestaurantStore();

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

const styles = StyleSheet.create({
  scroll: { backgroundColor: '#fff' },
  row: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  chip: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151', lineHeight: 18 },
  chipTextActive: { color: '#fff' },
});

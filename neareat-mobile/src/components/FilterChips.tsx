import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRestaurantStore } from '../store/restaurantStore';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

const PRICE_OPTIONS = [1, 2, 3, 4];
const PRICE_LABELS: Record<number, string> = { 1: '₺', 2: '₺₺', 3: '₺₺₺', 4: '₺₺₺₺' };

export default function FilterChips() {
  const { filters, setFilters } = useRestaurantStore();

  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  function togglePrice(level: number) {
    const exists = filters.priceLevels.includes(level);
    setFilters({
      priceLevels: exists
        ? filters.priceLevels.filter((p) => p !== level)
        : [...filters.priceLevels, level],
    });
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      <TouchableOpacity
        style={[styles.chip, filters.openNow && styles.chipActive, { marginRight: 8 }]}
        onPress={() => setFilters({ openNow: !filters.openNow })}
      >
        <Text style={[styles.chipText, filters.openNow && styles.chipTextActive]}>
          Şu an Açık
        </Text>
      </TouchableOpacity>

      {PRICE_OPTIONS.map((level, i) => {
        const active = filters.priceLevels.includes(level);
        return (
          <TouchableOpacity
            key={level}
            style={[styles.chip, active && styles.chipActive, i < PRICE_OPTIONS.length - 1 && { marginRight: 8 }]}
            onPress={() => togglePrice(level)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {PRICE_LABELS[level]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    scroll: { backgroundColor: C.surface, borderBottomWidth: 1, borderColor: C.separator },
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

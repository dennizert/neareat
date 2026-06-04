import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRestaurantStore } from '../store/restaurantStore';
import type { SortOption } from '../types';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'distance',         label: 'En Yakın' },
  { key: 'rating',           label: 'En Yüksek Puan' },
  { key: 'userRatingsTotal', label: 'En Çok Yorumlanan' },
];

export default function SortFilterBar() {
  const { filters, setFilters, sortBy, setSortBy } = useRestaurantStore();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [btnLayout, setBtnLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const sortBtnRef = useRef<View>(null);

  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const currentSort = SORT_OPTIONS.find((o) => o.key === sortBy) ?? SORT_OPTIONS[0];
  const isOpen = filters.openNow;

  function openDropdown() {
    sortBtnRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setBtnLayout({ x: px, y: py, width, height });
      setDropdownVisible(true);
    });
  }

  function selectSort(key: SortOption) {
    setSortBy(key);
    setDropdownVisible(false);
  }

  return (
    <>
      <View style={styles.bar}>
        {/* Left: "Açık" filtresi — etiket sabit, aktiflik radyo noktasıyla gösterilir */}
        <TouchableOpacity
          style={[styles.openToggle, isOpen && styles.openToggleActive]}
          onPress={() => setFilters({ openNow: !isOpen })}
          activeOpacity={0.75}
        >
          <View style={[styles.radio, isOpen && styles.radioActive]}>
            {isOpen && <View style={styles.radioDot} />}
          </View>
          <Text style={[styles.openLabel, isOpen && styles.openLabelActive]}>
            Açık
          </Text>
        </TouchableOpacity>

        <View style={styles.spacer} />

        {/* Right: Sort pill button */}
        <View ref={sortBtnRef} collapsable={false}>
          <TouchableOpacity
            style={[styles.sortPill, dropdownVisible && styles.sortPillOpen]}
            onPress={openDropdown}
            activeOpacity={0.8}
          >
            <View style={styles.sortPillInner}>
              <Text style={styles.sortPillHint}>Sıralama  </Text>
              <Text style={[styles.sortPillValue, dropdownVisible && styles.sortPillValueOpen]}>
                {currentSort.label}
              </Text>
            </View>
            <Text style={[styles.sortArrow, dropdownVisible && styles.sortArrowOpen]}>
              {dropdownVisible ? '▴' : '▾'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="none"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
          <View style={StyleSheet.absoluteFill}>
            <View
              style={[
                styles.dropdown,
                {
                  top: btnLayout.y + btnLayout.height + 4,
                  right: 16,
                  minWidth: Math.max(btnLayout.width, 210),
                },
              ]}
            >
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Sıralama Seçin</Text>
              </View>
              {SORT_OPTIONS.map((opt, i) => {
                const active = opt.key === sortBy;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.dropdownItem,
                      active && styles.dropdownItemActive,
                      i < SORT_OPTIONS.length - 1 && styles.dropdownItemBorder,
                    ]}
                    onPress={() => selectSort(opt.key)}
                    activeOpacity={0.7}
                  >
                    {/* Left: filled radio */}
                    <View style={[styles.itemRadio, active && styles.itemRadioActive]}>
                      {active && <View style={styles.itemRadioDot} />}
                    </View>
                    <Text style={[styles.dropdownLabel, active && styles.dropdownLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: C.separator,
    },
    spacer: { flex: 1 },

    // ── Radio / Open toggle ──────────────────────────────────
    openToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: C.disabled,
      backgroundColor: C.background,
    },
    openToggleActive: {
      borderColor: C.primary,
      backgroundColor: C.primaryLighter,
    },
    radio: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: C.textMuted,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 6,
    },
    radioActive: { borderColor: C.primary },
    radioDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.primary },
    openLabel: { fontSize: 13, fontWeight: '700', color: C.textTertiary },
    openLabelActive: { color: C.primary },

    // ── Sort pill ────────────────────────────────────────────
    sortPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: C.disabled,
      backgroundColor: C.background,
    },
    sortPillOpen: {
      borderColor: C.primary,
      backgroundColor: C.primaryLighter,
    },
    sortPillInner: { flexDirection: 'row', alignItems: 'baseline' },
    sortPillHint: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
    sortPillValue: { fontSize: 13, color: C.textPrimary, fontWeight: '700' },
    sortPillValueOpen: { color: C.primary },
    sortArrow: { fontSize: 11, color: C.textTertiary, marginLeft: 6, fontWeight: '700' },
    sortArrowOpen: { color: C.primary },

    // ── Dropdown card ────────────────────────────────────────
    dropdown: {
      position: 'absolute',
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      elevation: 10,
      overflow: 'hidden',
    },
    dropdownHeader: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderColor: C.separator,
    },
    dropdownTitle: { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    dropdownItemActive: { backgroundColor: C.primaryLighter },
    dropdownItemBorder: { borderBottomWidth: 1, borderColor: C.separator },
    itemRadio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: C.disabled,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    itemRadioActive: { borderColor: C.primary },
    itemRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
    dropdownLabel: { flex: 1, fontSize: 14, color: C.textSecondary, fontWeight: '500' },
    dropdownLabelActive: { color: C.primary, fontWeight: '700' },
  });
}

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRestaurantStore } from '../store/restaurantStore';
import type { SortOption } from '../types';

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
        {/* Left: radio toggle — "Açık" when unchecked, "Tümü" when checked */}
        <TouchableOpacity
          style={[styles.openToggle, isOpen && styles.openToggleActive]}
          onPress={() => setFilters({ openNow: !isOpen })}
          activeOpacity={0.75}
        >
          <View style={[styles.radio, isOpen && styles.radioActive]}>
            {isOpen && <View style={styles.radioDot} />}
          </View>
          <Text style={[styles.openLabel, isOpen && styles.openLabelActive]}>
            {isOpen ? 'Tümü' : 'Açık'}
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

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
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
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  openToggleActive: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF4F0',
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  radioActive: { borderColor: '#FF6B35' },
  radioDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FF6B35' },
  openLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  openLabelActive: { color: '#FF6B35' },

  // ── Sort pill ────────────────────────────────────────────
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  sortPillOpen: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF4F0',
  },
  sortPillInner: { flexDirection: 'row', alignItems: 'baseline' },
  sortPillHint: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  sortPillValue: { fontSize: 13, color: '#111827', fontWeight: '700' },
  sortPillValueOpen: { color: '#FF6B35' },
  sortArrow: { fontSize: 11, color: '#6B7280', marginLeft: 6, fontWeight: '700' },
  sortArrowOpen: { color: '#FF6B35' },

  // ── Dropdown card ────────────────────────────────────────
  dropdown: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
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
    borderColor: '#F3F4F6',
  },
  dropdownTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownItemActive: { backgroundColor: '#FFF4F0' },
  dropdownItemBorder: { borderBottomWidth: 1, borderColor: '#F3F4F6' },
  itemRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itemRadioActive: { borderColor: '#FF6B35' },
  itemRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B35' },
  dropdownLabel: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
  dropdownLabelActive: { color: '#FF6B35', fontWeight: '700' },
});

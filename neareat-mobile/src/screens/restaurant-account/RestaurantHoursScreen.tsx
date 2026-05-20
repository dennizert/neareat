import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { getMyRestaurantProfile, updateHours } from '../../services/restaurantAccount';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

const DAYS = [
  { key: 'monday', label: 'Pazartesi' },
  { key: 'tuesday', label: 'Salı' },
  { key: 'wednesday', label: 'Çarşamba' },
  { key: 'thursday', label: 'Perşembe' },
  { key: 'friday', label: 'Cuma' },
  { key: 'saturday', label: 'Cumartesi' },
  { key: 'sunday', label: 'Pazar' },
];

const DEFAULT_HOURS = Object.fromEntries(
  DAYS.map(d => [d.key, { open: '09:00', close: '22:00', closed: false }])
);

const TIME_OPTIONS = [
  ...Array.from({ length: 24 }, (_, h) => [`${h.toString().padStart(2, '0')}:00`, `${h.toString().padStart(2, '0')}:30`]).flat()
];

export default function RestaurantHoursScreen() {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPickerFor, setShowPickerFor] = useState<{ day: string; field: 'open' | 'close' } | null>(null);

  useEffect(() => {
    getMyRestaurantProfile().then(p => {
      if (p.openingHours) setHours({ ...DEFAULT_HOURS, ...(p.openingHours as any) });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function setField(day: string, field: 'open' | 'close' | 'closed', value: any) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateHours(hours);
      Alert.alert('Kaydedildi', 'Çalışma saatleri güncellendi.');
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>Her gün için açılış/kapanış saatini ayarlayın veya o günü kapalı işaretleyin.</Text>

        {DAYS.map(({ key, label }) => {
          const day = hours[key] ?? { open: '09:00', close: '22:00', closed: false };
          return (
            <View key={key} style={[styles.dayCard, day.closed && styles.dayCardClosed]}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayLabel, day.closed && styles.dayLabelClosed]}>{label}</Text>
                <View style={styles.closedRow}>
                  <Text style={styles.closedLabel}>Kapalı</Text>
                  <Switch
                    value={day.closed}
                    onValueChange={val => setField(key, 'closed', val)}
                    trackColor={{ false: C.border, true: C.error }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              {!day.closed && (
                <View style={styles.timeRow}>
                  <TouchableOpacity style={styles.timePicker} onPress={() => setShowPickerFor({ day: key, field: 'open' })}>
                    <Text style={styles.timePickerLabel}>Açılış</Text>
                    <Text style={styles.timePickerValue}>{day.open}</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeSep}>→</Text>
                  <TouchableOpacity style={styles.timePicker} onPress={() => setShowPickerFor({ day: key, field: 'close' })}>
                    <Text style={styles.timePickerLabel}>Kapanış</Text>
                    <Text style={styles.timePickerValue}>{day.close}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Time picker modal */}
      {showPickerFor && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {showPickerFor.field === 'open' ? 'Açılış Saati' : 'Kapanış Saati'} — {DAYS.find(d => d.key === showPickerFor.day)?.label}
              </Text>
              <TouchableOpacity onPress={() => setShowPickerFor(null)}>
                <Text style={styles.pickerClose}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 240 }}>
              {TIME_OPTIONS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.timeOption, (hours[showPickerFor.day] ?? {})[showPickerFor.field] === t && styles.timeOptionActive]}
                  onPress={() => {
                    setField(showPickerFor.day, showPickerFor.field, t);
                    setShowPickerFor(null);
                  }}
                >
                  <Text style={[styles.timeOptionText, (hours[showPickerFor.day] ?? {})[showPickerFor.field] === t && styles.timeOptionTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    body: { padding: 16, paddingBottom: 32 },
    hint: { fontSize: 13, color: C.textTertiary, marginBottom: 16, lineHeight: 18 },
    dayCard: {
      backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10,
      shadowColor: C.shadow, shadowOpacity: 0.04, elevation: 1,
    },
    dayCardClosed: { opacity: 0.6 },
    dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    dayLabel: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    dayLabelClosed: { color: C.textMuted },
    closedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    closedLabel: { fontSize: 13, color: C.error, fontWeight: '600' },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    timePicker: {
      flex: 1, backgroundColor: C.background, borderRadius: 10, padding: 10,
      borderWidth: 1, borderColor: C.border, alignItems: 'center',
    },
    timePickerLabel: { fontSize: 11, color: C.textMuted, marginBottom: 2 },
    timePickerValue: { fontSize: 18, fontWeight: '700', color: C.primary },
    timeSep: { fontSize: 16, color: C.textMuted },
    pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    pickerSheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
    pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.separator },
    pickerTitle: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    pickerClose: { fontSize: 15, color: C.textTertiary },
    timeOption: { paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.separator },
    timeOptionActive: { backgroundColor: C.primaryLighter },
    timeOptionText: { fontSize: 15, color: C.textSecondary },
    timeOptionTextActive: { color: C.primary, fontWeight: '700' },
    footer: { padding: 16, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.separator },
    saveBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  });
}

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, Switch,
} from 'react-native';
import {
  getMyRestaurantProfile, updateDiscount,
  activateInstantDiscount, deactivateInstantDiscount,
} from '../../services/restaurantAccount';
import type { RestaurantProfile } from '../../types';

const STAR_RATES = [
  { label: 'Seviye 2 (10+ ⭐)', pct: 10 },
  { label: 'Seviye 3 (25+ ⭐)', pct: 15 },
  { label: 'Seviye 4 (50+ ⭐)', pct: 20 },
  { label: 'Seviye 5 (100+ ⭐)', pct: 25 },
];

const DURATION_OPTIONS = [
  { label: '30 dk', value: 30 },
  { label: '1 saat', value: 60 },
  { label: '2 saat', value: 120 },
  { label: '3 saat', value: 180 },
];

export default function RestaurantDiscountScreen() {
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Yıldız programı
  const [starEnabled, setStarEnabled] = useState(false);

  // Anlık indirim
  const [instantPercent, setInstantPercent] = useState('');
  const [instantNote, setInstantNote] = useState('');

  useEffect(() => {
    getMyRestaurantProfile().then(p => {
      setProfile(p);
      setStarEnabled(p.discountEnabled);
      setInstantPercent(p.discountPercent?.toString() ?? '');
      setInstantNote(p.discountNote ?? '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSaveStarProgram() {
    setSaving(true);
    try {
      const updated = await updateDiscount({ starDiscountEnabled: starEnabled });
      setProfile(updated);
      Alert.alert('Kaydedildi', starEnabled ? 'Yıldız programına katıldınız.' : 'Yıldız programından ayrıldınız.');
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleActivateInstant(duration: number) {
    const pct = parseFloat(instantPercent);
    if (!pct || pct < 1 || pct > 80) {
      Alert.alert('Hata', 'İndirim oranı %1-%80 arasında olmalı.');
      return;
    }
    setSaving(true);
    try {
      const updated = await activateInstantDiscount(duration, pct, instantNote.trim() || undefined);
      setProfile(updated);
      Alert.alert('Aktif!', `%${pct} anlık indirim ${duration < 60 ? duration + ' dk' : duration / 60 + ' saat'} için başlatıldı.`);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Aktif edilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    setSaving(true);
    try {
      const updated = await deactivateInstantDiscount();
      setProfile(updated);
      Alert.alert('Durduruldu', 'Anlık indirim durduruldu.');
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Durdurulamadı.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#FF6B35" size="large" />;

  const now = new Date();
  const instantActive = profile?.discountActiveUntil && new Date(profile.discountActiveUntil) > now;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.body}>

      {/* Yıldız Programı */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>⭐ Yıldız Programı</Text>
          <Switch
            value={starEnabled}
            onValueChange={setStarEnabled}
            trackColor={{ false: '#E5E7EB', true: '#4F46E5' }}
            thumbColor="#fff"
          />
        </View>
        <Text style={styles.cardSubtitle}>
          Programa katılarak kullanıcılara yıldız seviyelerine göre otomatik indirim sunun.
          Kullanıcılar sizi "Seçili Restoran" olarak görür.
        </Text>

        <View style={styles.rateTable}>
          <View style={styles.rateTableHeader}>
            <Text style={styles.rateHeaderText}>Seviye</Text>
            <Text style={styles.rateHeaderText}>İndirim</Text>
          </View>
          {STAR_RATES.map(row => (
            <View key={row.pct} style={styles.rateRow}>
              <Text style={styles.rateLevelText}>{row.label}</Text>
              <View style={styles.ratePctBadge}>
                <Text style={styles.ratePctText}>%{row.pct}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSaveStarProgram}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>Kaydet</Text>}
        </TouchableOpacity>
      </View>

      {/* Anlık İndirim */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚡ Anlık İndirim</Text>
        <Text style={styles.cardSubtitle}>
          Restoranınız için kısa süreli indirim başlatın. Yıldız programından bağımsız çalışır.
          Restoran kartında parlak badge ile öne çıkar.
        </Text>

        {instantActive ? (
          <View>
            <View style={styles.activeBanner}>
              <Text style={styles.activeBannerText}>
                ✅ Aktif — %{profile?.discountPercent} indirim · {new Date(profile!.discountActiveUntil!).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} kadar
              </Text>
              {profile?.discountNote ? (
                <Text style={styles.activeBannerNote}>{profile.discountNote}</Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.deactivateBtn} onPress={handleDeactivate} disabled={saving}>
              <Text style={styles.deactivateBtnText}>Durdur</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.fieldLabel}>İndirim Oranı (%)</Text>
            <TextInput
              style={styles.input}
              value={instantPercent}
              onChangeText={setInstantPercent}
              keyboardType="numeric"
              placeholder="Örn: 20"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.fieldLabel}>Not (opsiyonel)</Text>
            <TextInput
              style={styles.input}
              value={instantNote}
              onChangeText={setInstantNote}
              placeholder="Örn: Yalnızca hafta içi geçerli"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.fieldLabel}>Süre Seç</Text>
            <View style={styles.durationGrid}>
              {DURATION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.durationBtn, saving && { opacity: 0.4 }]}
                  onPress={() => handleActivateInstant(opt.value)}
                  disabled={saving}
                >
                  <Text style={styles.durationBtnText}>{opt.label}</Text>
                  <Text style={styles.durationBtnSub}>başlat</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardSubtitle: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 14 },
  rateTable: {
    backgroundColor: '#F9FAFB', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 14,
  },
  rateTableHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#EEF2FF',
  },
  rateHeaderText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },
  rateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  rateLevelText: { fontSize: 13, color: '#374151' },
  ratePctBadge: { backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  ratePctText: { fontSize: 13, fontWeight: '800', color: '#4F46E5' },
  saveBtn: { backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    color: '#111827', backgroundColor: '#FAFAFA', marginBottom: 12,
  },
  activeBanner: { backgroundColor: '#DCFCE7', borderRadius: 10, padding: 12, marginBottom: 10 },
  activeBannerText: { color: '#166534', fontWeight: '600', fontSize: 13 },
  activeBannerNote: { color: '#166534', fontSize: 12, marginTop: 4 },
  deactivateBtn: { backgroundColor: '#EF4444', borderRadius: 10, padding: 12, alignItems: 'center' },
  deactivateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  durationBtn: {
    flex: 1, minWidth: '40%', backgroundColor: '#FF6B35', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  durationBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  durationBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
});

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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

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
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />;

  const now = new Date();
  const instantActive = profile?.discountActiveUntil && new Date(profile.discountActiveUntil) > now;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.body, { paddingBottom: bottom + 16 }]}>

      {/* Yıldız Programı */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>⭐ Yıldız Programı</Text>
          <Switch
            value={starEnabled}
            onValueChange={setStarEnabled}
            trackColor={{ false: C.border, true: C.amber }}
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
              placeholderTextColor={C.textMuted}
            />

            <Text style={styles.fieldLabel}>Not (opsiyonel)</Text>
            <TextInput
              style={styles.input}
              value={instantNote}
              onChangeText={setInstantNote}
              placeholder="Örn: Yalnızca hafta içi geçerli"
              placeholderTextColor={C.textMuted}
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

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    body: { padding: 16, gap: 14, paddingBottom: 40 },
    card: {
      backgroundColor: C.surface, borderRadius: 16, padding: 16,
      shadowColor: C.shadow, shadowOpacity: 0.05, elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
    cardSubtitle: { fontSize: 13, color: C.textTertiary, lineHeight: 18, marginBottom: 14 },
    rateTable: {
      backgroundColor: C.background, borderRadius: 12, overflow: 'hidden',
      borderWidth: 1, borderColor: C.border, marginBottom: 14,
    },
    rateTableHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.amberSurface,
    },
    rateHeaderText: { fontSize: 12, fontWeight: '700', color: C.amber },
    rateRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 14, paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: C.border,
    },
    rateLevelText: { fontSize: 13, color: C.textSecondary },
    ratePctBadge: { backgroundColor: C.amberSurface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
    ratePctText: { fontSize: 13, fontWeight: '800', color: C.amber },
    saveBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    saveBtnText: { color: C.primaryOn, fontWeight: '700', fontSize: 15 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 6, marginTop: 4 },
    input: {
      borderWidth: 1, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
      color: C.textPrimary, backgroundColor: C.inputBg, marginBottom: 12,
    },
    activeBanner: { backgroundColor: C.successSurface, borderRadius: 10, padding: 12, marginBottom: 10 },
    activeBannerText: { color: C.success, fontWeight: '600', fontSize: 13 },
    activeBannerNote: { color: C.success, fontSize: 12, marginTop: 4 },
    deactivateBtn: { backgroundColor: C.error, borderRadius: 10, padding: 12, alignItems: 'center' },
    deactivateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    durationBtn: {
      flex: 1, minWidth: '40%', backgroundColor: C.primary, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center',
    },
    durationBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    durationBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  });
}

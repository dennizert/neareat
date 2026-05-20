import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

const FEATURES = [
  '📍 Sınırsız mesafede restoran ara',
  '❤️ Sınırsız favori kaydet',
  '🚫 Reklamsız deneyim',
  '💬 Yorum yaz ve puan ver',
  '📊 En kalabalık saatler',
  '📵 Çevrimdışı favori görüntüle',
  '📱 iOS Ana Ekran Widget\'ı',
];

export default function PaywallScreen() {
  const navigation = useNavigation<any>();
  const { setSubscription } = useAuthStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<'yearly' | 'monthly'>('yearly');

  async function handleTrial() {
    try {
      setLoading(true);
      const { data } = await api.post('/subscriptions/trial');
      setSubscription(data);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Deneme başlatılamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.title}>NearEat Premium</Text>
      <Text style={styles.subtitle}>Tüm özelliklere erişin</Text>

      <View style={styles.featureList}>
        {FEATURES.map((f) => (
          <Text key={f} style={styles.featureItem}>{f}</Text>
        ))}
      </View>

      <View style={styles.planRow}>
        <TouchableOpacity
          style={[styles.planCard, selected === 'yearly' && styles.planCardActive]}
          onPress={() => setSelected('yearly')}
        >
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>En Popüler</Text>
          </View>
          <Text style={styles.planName}>Yıllık</Text>
          <Text style={styles.planPrice}>— TRY/yıl</Text>
          <Text style={styles.planSavings}>%35 tasarruf</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.planCard, selected === 'monthly' && styles.planCardActive]}
          onPress={() => setSelected('monthly')}
        >
          <Text style={styles.planName}>Aylık</Text>
          <Text style={styles.planPrice}>— TRY/ay</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={handleTrial} disabled={loading}>
        <Text style={styles.primaryBtnText}>{loading ? 'İşleniyor...' : '7 Gün Ücretsiz Dene'}</Text>
      </TouchableOpacity>

      <Text style={styles.legal}>Devam ederek Kullanım Şartları ve Gizlilik Politikasını kabul etmiş olursunuz.</Text>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.surface, padding: 24, paddingTop: 48 },
    closeBtn: { position: 'absolute', top: 48, right: 24, zIndex: 10 },
    closeBtnText: { fontSize: 20, color: C.textMuted },
    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, textAlign: 'center', marginBottom: 4 },
    subtitle: { fontSize: 15, color: C.textTertiary, textAlign: 'center', marginBottom: 24 },
    featureList: { marginBottom: 24 },
    featureItem: { fontSize: 15, color: C.textSecondary, marginBottom: 8, lineHeight: 22 },
    planRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    planCard: { flex: 1, borderRadius: 14, borderWidth: 2, borderColor: C.border, padding: 16, alignItems: 'center' },
    planCardActive: { borderColor: C.primary, backgroundColor: C.primaryLighter },
    popularBadge: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
    popularText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    planName: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    planPrice: { fontSize: 13, color: C.textTertiary, marginTop: 2 },
    planSavings: { fontSize: 11, color: C.success, marginTop: 2 },
    primaryBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    legal: { fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 16 },
  });
}

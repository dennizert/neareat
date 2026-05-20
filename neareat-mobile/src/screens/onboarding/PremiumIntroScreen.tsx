import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { MOCK_MODE } from '../../config';
import { MOCK_SUBSCRIPTION } from '../../mocks/data';
import api from '../../services/api';
import { useAppInit } from '../../hooks/useAppInit';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

const FEATURES = [
  '📍 Sınırsız mesafede restoran ara',
  '❤️ Sınırsız favori kaydet',
  '🚫 Reklamsız deneyim',
  '💬 Yorum yaz ve puan ver',
  '📊 En kalabalık saatler',
  '📵 Çevrimdışı favori görüntüle',
];

export default function PremiumIntroScreen() {
  const { pendingUser, setUser, setSubscription } = useAuthStore();
  const { initApp } = useAppInit();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const [loading, setLoading] = useState(false);

  async function handleTrial() {
    try {
      setLoading(true);
      if (MOCK_MODE) {
        setSubscription(MOCK_SUBSCRIPTION);
        await initApp();
        setUser(pendingUser!);
        return;
      }
      const { data } = await api.post('/subscriptions/trial');
      setSubscription(data);
      await initApp();
      setUser(pendingUser!);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Deneme başlatılamadı.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await initApp();
    setUser(pendingUser!);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>7 gün ücretsiz dene</Text>
      <View style={styles.featureList}>
        {FEATURES.map((f) => (
          <Text key={f} style={styles.featureItem}>{f}</Text>
        ))}
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={handleTrial} disabled={loading}>
        <Text style={styles.primaryBtnText}>{loading ? 'Başlatılıyor...' : 'Ücretsiz Dene'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleSkip}>
        <Text style={styles.skipText}>Hayır, teşekkürler</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: C.surface },
    title: { fontSize: 26, fontWeight: '700', color: C.textPrimary, marginBottom: 28, textAlign: 'center' },
    featureList: { width: '100%', marginBottom: 36 },
    featureItem: { fontSize: 16, color: C.textSecondary, marginBottom: 10, lineHeight: 24 },
    primaryBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48, marginBottom: 16 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    skipText: { color: C.textMuted, fontSize: 14 },
  });
}

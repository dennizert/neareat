import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useAppInit } from '../../hooks/useAppInit';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

// S18: kullanıcı premium'u kaldırıldı — özellikler yıldız SEVİYESİNE göre açılır.
// Ekran artık satın alınamayan bir denemeyi pazarlamıyor; kazanım sistemini tanıtıyor.
const FEATURES = [
  '⭐ Yorum yaz, puan ver, yıldız kazan',
  '🍽️ Gittiğin yerleri günlüğüne ekle',
  '📈 Seviye atladıkça yeni özellikler açılır',
  '❤️ Favori ve liste hakkın seviyeyle artar',
  '🤖 Günlük AI öneri hakkın seviyeyle artar',
];

export default function PremiumIntroScreen() {
  const { pendingUser, setUser } = useAuthStore();
  const { initApp } = useAppInit();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    try {
      setLoading(true);
      await initApp();
      setUser(pendingUser!);
    } catch {
      Alert.alert('Hata', 'Bir sorun oluştu, tekrar dener misin?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kullandıkça seviye atla</Text>
      <View style={styles.featureList}>
        {FEATURES.map((f) => (
          <Text key={f} style={styles.featureItem}>{f}</Text>
        ))}
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue} disabled={loading}>
        <Text style={styles.primaryBtnText}>{loading ? 'Hazırlanıyor...' : 'Başla'}</Text>
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

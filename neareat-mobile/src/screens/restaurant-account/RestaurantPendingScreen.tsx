import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import type { ApprovalStatus } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

export default function RestaurantPendingScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { logout } = useAuthStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const { status, rejectionReason } = route.params as { status: ApprovalStatus; rejectionReason?: string | null };

  const isRejected = status === 'REJECTED';

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{isRejected ? '❌' : '⏳'}</Text>
      <Text style={styles.title}>
        {isRejected ? 'Başvuru Reddedildi' : 'Başvurunuz İnceleniyor'}
      </Text>
      <Text style={styles.subtitle}>
        {isRejected
          ? 'Başvurunuz maalesef reddedildi. Düzelterek yeniden başvurabilirsiniz.'
          : 'Yönetim ekibimiz başvurunuzu inceliyor. Onay sonrası bu ekrandan panele yönlendirileceksiniz.'}
      </Text>

      {isRejected && rejectionReason && (
        <View style={styles.reasonCard}>
          <Text style={styles.reasonLabel}>Red Nedeni:</Text>
          <Text style={styles.reasonText}>{rejectionReason}</Text>
        </View>
      )}

      {!isRejected && (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>📧 Onay e-postası gönderildiğinde tekrar giriş yapabilirsiniz.</Text>
          <Text style={styles.infoText}>⏱ Ortalama inceleme süresi: 1-3 iş günü</Text>
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutBtnText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
    icon: { fontSize: 72, marginBottom: 16 },
    title: { fontSize: 22, fontWeight: '800', color: C.textPrimary, textAlign: 'center', marginBottom: 12 },
    subtitle: { fontSize: 15, color: C.textTertiary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    reasonCard: {
      backgroundColor: C.errorSurface, borderRadius: 14, padding: 16, width: '100%', marginBottom: 20,
      borderWidth: 1, borderColor: '#FECACA',
    },
    reasonLabel: { fontSize: 13, fontWeight: '700', color: '#DC2626', marginBottom: 6 },
    reasonText: { fontSize: 14, color: '#7F1D1D', lineHeight: 20 },
    infoCard: {
      backgroundColor: '#F0F9FF', borderRadius: 14, padding: 16, width: '100%', marginBottom: 24, gap: 8,
      borderWidth: 1, borderColor: '#BAE6FD',
    },
    infoText: { fontSize: 13, color: '#0369A1', lineHeight: 20 },
    logoutBtn: {
      backgroundColor: C.error, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8,
    },
    logoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}

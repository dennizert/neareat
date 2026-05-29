import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { resendVerification } from '../../services/auth';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

interface Props {
  email: string;
}

export default function EmailVerificationScreen({ route }: { route: any }) {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const email: string = route?.params?.email ?? '';
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);

  async function handleResend() {
    const now = Date.now();
    if (resentAt && now - resentAt < 60_000) {
      Alert.alert('Bekle', 'Yeni e-posta göndermek için 1 dakika bekle.');
      return;
    }

    try {
      setResending(true);
      await resendVerification();
      setResentAt(now);
      Alert.alert('Gönderildi', 'Doğrulama e-postası tekrar gönderildi. Spam klasörünü de kontrol et.');
    } catch {
      Alert.alert('Hata', 'E-posta gönderilemedi. Daha sonra tekrar dene.');
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📧</Text>
      <Text style={styles.title}>E-postanı Doğrula</Text>
      <Text style={styles.subtitle}>
        <Text style={styles.emailHighlight}>{email}</Text>
        {' '}adresine bir doğrulama bağlantısı gönderdik.{'\n\n'}
        Bağlantıya tıklayarak hesabını doğrulayabilirsin. Şimdilik uygulamayı kullanmaya devam edebilirsin.
      </Text>

      <View style={styles.hintBox}>
        <Text style={styles.hintTitle}>📌 İpuçları</Text>
        <Text style={styles.hintItem}>• E-posta gelmedi mi? Spam klasörünü kontrol et.</Text>
        <Text style={styles.hintItem}>• Bağlantı 24 saat geçerlidir.</Text>
        <Text style={styles.hintItem}>• Telefonda açıyorsan Eatlas otomatik açılır.</Text>
      </View>

      <TouchableOpacity
        style={[styles.resendBtn, resending && styles.btnDisabled]}
        onPress={handleResend}
        disabled={resending}
      >
        {resending ? (
          <ActivityIndicator color={C.primary} />
        ) : (
          <Text style={styles.resendBtnText}>Tekrar Gönder</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.continueBtn} onPress={() => navigation.navigate('PremiumIntro')}>
        <Text style={styles.continueBtnText}>Şimdilik Geç →</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1, backgroundColor: C.surface,
      justifyContent: 'center', alignItems: 'center', padding: 28,
    },
    icon: { fontSize: 64, marginBottom: 16 },
    title: { fontSize: 24, fontWeight: '800', color: C.textPrimary, marginBottom: 12, textAlign: 'center' },
    subtitle: { fontSize: 15, color: C.textTertiary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    emailHighlight: { color: C.primary, fontWeight: '700' },

    hintBox: {
      backgroundColor: C.background, borderRadius: 12, padding: 16,
      width: '100%', marginBottom: 28, borderWidth: 1, borderColor: C.border,
    },
    hintTitle: { fontSize: 14, fontWeight: '700', color: C.textSecondary, marginBottom: 8 },
    hintItem: { fontSize: 13, color: C.textTertiary, lineHeight: 20, marginBottom: 4 },

    resendBtn: {
      borderWidth: 1.5, borderColor: C.primary, borderRadius: 12,
      paddingVertical: 13, paddingHorizontal: 32, marginBottom: 14, minWidth: 180, alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    resendBtnText: { color: C.primary, fontSize: 15, fontWeight: '700' },

    continueBtn: { paddingVertical: 10 },
    continueBtnText: { color: C.textTertiary, fontSize: 14 },
  });
}

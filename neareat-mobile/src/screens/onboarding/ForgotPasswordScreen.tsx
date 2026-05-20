import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { forgotPassword } from '../../services/auth';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Hata', 'E-posta adresi zorunlu.');
      return;
    }

    try {
      setLoading(true);
      await forgotPassword(trimmed);
      setSent(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Bir sorun oluştu. Lütfen tekrar dene.';
      Alert.alert('Hata', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>

        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>Şifremi Unuttum</Text>

        {sent ? (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>📬</Text>
            <Text style={styles.successTitle}>E-posta Gönderildi</Text>
            <Text style={styles.successText}>
              Eğer bu e-posta NearEat'te kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.{'\n\n'}
              Gelen kutunu ve spam klasörünü kontrol et.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryBtnText}>Giriş Ekranına Dön</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.subtitle}>
              E-posta adresini gir. Şifre sıfırlama bağlantısı göndereceğiz.
            </Text>

            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              placeholder="ornek@email.com"
              placeholderTextColor={C.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSend}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Bağlantı Gönder</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.surface },
    container: { flexGrow: 1, padding: 28, paddingTop: 60 },
    backBtn: { marginBottom: 24 },
    backText: { fontSize: 15, color: C.primary, fontWeight: '600' },
    icon: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, marginBottom: 8, textAlign: 'center' },

    form: { marginTop: 8 },
    subtitle: { fontSize: 15, color: C.textTertiary, lineHeight: 22, marginBottom: 24, textAlign: 'center' },
    label: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 6, marginTop: 8 },
    input: {
      backgroundColor: C.background, borderWidth: 1, borderColor: C.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.textPrimary,
    },
    primaryBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
    btnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    successBox: { marginTop: 16, alignItems: 'center' },
    successIcon: { fontSize: 52, marginBottom: 16 },
    successTitle: { fontSize: 20, fontWeight: '800', color: C.textPrimary, marginBottom: 12 },
    successText: { fontSize: 15, color: C.textTertiary, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  });
}

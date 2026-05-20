import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { registerWithEmail } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { MOCK_MODE } from '../../config';
import { MOCK_USER } from '../../mocks/data';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import PrivacyPolicyModal from '../../components/PrivacyPolicyModal';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { setPendingUser } = useAuthStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [policyVisible, setPolicyVisible] = useState(false);
  const [policyTab, setPolicyTab] = useState<'privacy' | 'kvkk'>('privacy');

  async function handleRegister() {
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      Alert.alert('Hata', 'Tüm alanlar zorunlu.');
      return;
    }
    if (trimmedName.length < 2) {
      Alert.alert('Hata', 'İsim en az 2 karakter olmalı.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }

    try {
      setLoading(true);
      if (MOCK_MODE) {
        setPendingUser({ ...MOCK_USER, displayName: trimmedName, email: trimmedEmail });
        navigation.navigate('PremiumIntro');
        return;
      }
      const { user } = await registerWithEmail(trimmedEmail, password, trimmedName);
      setPendingUser(user);
      navigation.navigate('EmailVerification', { email: trimmedEmail });
    } catch (err: any) {
      const detail = err.response?.data?.error || err.message || 'Kayıt oluşturulamadı.';
      Alert.alert('Kayıt Hatası', detail);
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

        <Text style={styles.title}>Hesap Oluştur</Text>
        <Text style={styles.subtitle}>NearEat'e katıl, restoranları keşfet.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Ad Soyad</Text>
          <TextInput
            style={styles.input}
            placeholder="Adınız Soyadınız"
            placeholderTextColor={C.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoCorrect={false}
          />

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
          />

          <Text style={styles.label}>Şifre</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="En az 6 karakter"
              placeholderTextColor={C.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
              <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Şifre Tekrar</Text>
          <TextInput
            style={[
              styles.input,
              confirmPassword.length > 0 && confirmPassword !== password && styles.inputError,
            ]}
            placeholder="Şifrenizi tekrar girin"
            placeholderTextColor={C.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          {confirmPassword.length > 0 && confirmPassword !== password && (
            <Text style={styles.errorText}>Şifreler eşleşmiyor</Text>
          )}

          <View style={styles.privacyNotice}>
            <Text style={styles.privacyText}>
              Kayıt olarak{' '}
              <Text
                style={styles.privacyLink}
                onPress={() => { setPolicyTab('privacy'); setPolicyVisible(true); }}
              >
                Gizlilik Politikası
              </Text>
              {' '}ve{' '}
              <Text
                style={styles.privacyLink}
                onPress={() => { setPolicyTab('kvkk'); setPolicyVisible(true); }}
              >
                KVKK Aydınlatma Metni
              </Text>
              {'\'ni okuduğunuzu ve kabul ettiğinizi onaylıyorsunuz.'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Kayıt Ol</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Zaten hesabın var mı? <Text style={styles.linkBold}>Giriş Yap</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <PrivacyPolicyModal
        visible={policyVisible}
        onClose={() => setPolicyVisible(false)}
        initialSection={policyTab}
      />
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.surface },
    container: { flexGrow: 1, padding: 28, paddingTop: 60 },
    backBtn: { marginBottom: 24 },
    backText: { fontSize: 15, color: C.primary, fontWeight: '600' },
    title: { fontSize: 28, fontWeight: '800', color: C.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 15, color: C.textTertiary, lineHeight: 22, marginBottom: 28 },

    form: { width: '100%' },
    label: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 6, marginTop: 14 },
    input: { backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.textPrimary },
    inputError: { borderColor: C.error },
    errorText: { fontSize: 12, color: C.error, marginTop: 4 },
    passwordRow: { flexDirection: 'row', backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 10, alignItems: 'center' },
    passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.textPrimary },
    eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
    eyeText: { fontSize: 16 },

    privacyNotice: {
      backgroundColor: C.background, borderRadius: 10, padding: 12,
      marginTop: 20, borderWidth: 1, borderColor: C.border,
    },
    privacyText: { fontSize: 12, color: C.textTertiary, lineHeight: 18, textAlign: 'center' },
    privacyLink: { color: C.primary, fontWeight: '600', textDecorationLine: 'underline' },

    primaryBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
    btnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    linkRow: { alignItems: 'center', marginTop: 16 },
    linkText: { fontSize: 14, color: C.textTertiary },
    linkBold: { color: C.primary, fontWeight: '700' },
  });
}

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

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { setPendingUser } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
      navigation.navigate('PremiumIntro');
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
            placeholderTextColor="#9CA3AF"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <Text style={styles.label}>E-posta</Text>
          <TextInput
            style={styles.input}
            placeholder="ornek@email.com"
            placeholderTextColor="#9CA3AF"
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
              placeholderTextColor="#9CA3AF"
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
            placeholderTextColor="#9CA3AF"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          {confirmPassword.length > 0 && confirmPassword !== password && (
            <Text style={styles.errorText}>Şifreler eşleşmiyor</Text>
          )}

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 28, paddingTop: 60 },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 15, color: '#FF6B35', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 28 },

  form: { width: '100%' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
  inputError: { borderColor: '#EF4444' },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 4 },
  passwordRow: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, alignItems: 'center' },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  eyeText: { fontSize: 16 },

  primaryBtn: { backgroundColor: '#FF6B35', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  linkRow: { alignItems: 'center', marginTop: 16 },
  linkText: { fontSize: 14, color: '#6B7280' },
  linkBold: { color: '#FF6B35', fontWeight: '700' },
});

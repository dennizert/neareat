import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { resetPassword } from '../../services/auth';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

export default function ResetPasswordScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const token: string = route.params?.token ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleReset() {
    if (!password || !confirmPassword) {
      Alert.alert('Hata', 'Tüm alanlar zorunlu.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Hata', 'Şifre en az 8 karakter olmalı.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    if (!token) {
      Alert.alert('Hata', 'Geçersiz sıfırlama bağlantısı.');
      return;
    }

    try {
      setLoading(true);
      await resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Bir sorun oluştu. Bağlantının süresi dolmuş olabilir.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View style={[styles.flex, styles.centerContent]}>
        <Text style={styles.doneIcon}>✅</Text>
        <Text style={styles.doneTitle}>Şifren Güncellendi!</Text>
        <Text style={styles.doneText}>Yeni şifrenle giriş yapabilirsin.</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.primaryBtnText}>Giriş Yap</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.icon}>🔑</Text>
        <Text style={styles.title}>Yeni Şifre Belirle</Text>
        <Text style={styles.subtitle}>En az 8 karakter uzunluğunda bir şifre seç.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Yeni Şifre</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="En az 8 karakter"
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

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleReset}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Şifremi Güncelle</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.surface },
    centerContent: { justifyContent: 'center', alignItems: 'center', padding: 28 },
    container: { flexGrow: 1, padding: 28, paddingTop: 80, alignItems: 'center' },
    icon: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 15, color: C.textTertiary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

    form: { width: '100%' },
    label: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 6, marginTop: 14 },
    input: {
      backgroundColor: C.background, borderWidth: 1, borderColor: C.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.textPrimary,
    },
    inputError: { borderColor: C.error },
    errorText: { fontSize: 12, color: C.error, marginTop: 4 },
    passwordRow: {
      flexDirection: 'row', backgroundColor: C.background,
      borderWidth: 1, borderColor: C.border, borderRadius: 10, alignItems: 'center',
    },
    passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.textPrimary },
    eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
    eyeText: { fontSize: 16 },
    primaryBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
    btnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    doneIcon: { fontSize: 64, marginBottom: 16 },
    doneTitle: { fontSize: 22, fontWeight: '800', color: C.textPrimary, marginBottom: 10, textAlign: 'center' },
    doneText: { fontSize: 15, color: C.textTertiary, textAlign: 'center', marginBottom: 28 },
  });
}

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signInWithGoogle, loginWithEmail } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { useAppInit } from '../../hooks/useAppInit';
import { MOCK_MODE } from '../../config';
import { MOCK_USER } from '../../mocks/data';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

type AuthTab = 'email' | 'google';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { setPendingUser, setUser, setSubscription, setRestaurantStatus } = useAuthStore();
  const { initApp } = useAppInit();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [tab, setTab] = useState<AuthTab>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Hata', 'E-posta ve şifre zorunlu.');
      return;
    }
    try {
      setLoading(true);
      if (MOCK_MODE) {
        setPendingUser(MOCK_USER);
        navigation.navigate('PremiumIntro');
        return;
      }
      const { user, subscription, restaurantProfile } = await loginWithEmail(email.trim(), password) as any;
      // Admin and restaurant accounts go directly to their flows
      if (user.role === 'ADMIN' || user.role === 'RESTAURANT') {
        if (subscription) setSubscription(subscription);
        if (restaurantProfile) setRestaurantStatus({ status: restaurantProfile.status, rejectionReason: restaurantProfile.rejectionReason });
        setUser(user);
        return;
      }
      if (subscription) {
        setSubscription(subscription);
        await initApp();
        setUser(user);
      } else {
        setPendingUser(user);
        navigation.navigate('PremiumIntro');
      }
    } catch (err: any) {
      Alert.alert('Giriş Hatası', err.userMessage || err.response?.data?.error || 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setLoading(true);
      if (MOCK_MODE) {
        setPendingUser(MOCK_USER);
        navigation.navigate('PremiumIntro');
        return;
      }
      const { user, subscription } = await signInWithGoogle();
      if (subscription) {
        setSubscription(subscription);
        await initApp();
        setUser(user);
      } else {
        setPendingUser(user);
        navigation.navigate('PremiumIntro');
      }
    } catch (err: any) {
      // userMessage interceptor'dan gelir (API hataları); Google SDK hatalarında message'a düş
      Alert.alert('Giriş Hatası', err.userMessage || err.message || 'Google ile giriş yapılamadı.');
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
        <Text style={styles.logo}>🍽️</Text>
        <Text style={styles.title}>Hoş geldin</Text>
        <Text style={styles.subtitle}>Favorilerini kaydet, yorum yap, kişiselleştirilmiş deneyim yaşa.</Text>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'email' && styles.tabActive]}
            onPress={() => setTab('email')}
          >
            <Text style={[styles.tabText, tab === 'email' && styles.tabTextActive]}>E-posta</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'google' && styles.tabActive]}
            onPress={() => setTab('google')}
          >
            <Text style={[styles.tabText, tab === 'google' && styles.tabTextActive]}>Google</Text>
          </TouchableOpacity>
        </View>

        {tab === 'email' ? (
          <View style={styles.form}>
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

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleEmailLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Giriş Yap</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotRow} onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.forgotText}>Şifremi Unuttum</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Register')}>
              <Text style={styles.linkText}>Hesabın yok mu? <Text style={styles.linkBold}>Kayıt Ol</Text></Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.googleHint}>Google hesabınla hızlıca giriş yap.</Text>
            <TouchableOpacity
              style={[styles.googleBtn, loading && styles.btnDisabled]}
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={C.textPrimary} />
              ) : (
                <Text style={styles.googleBtnText}>
                  {MOCK_MODE ? '🧪 Test Kullanıcısı ile Giriş' : 'Google ile Giriş Yap'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Restaurant register link */}
        <View style={styles.restaurantLinkRow}>
          <Text style={styles.restaurantLinkLabel}>İşletme sahibi misiniz?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('RestaurantRegister')}>
            <Text style={styles.restaurantLink}> İşletme Hesabı Oluştur</Text>
          </TouchableOpacity>
        </View>

        {MOCK_MODE && (
          <Text style={styles.mockBadge}>MOCK MODE — Backend bağlantısı yok</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.surface },
    container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
    logo: { fontSize: 64, marginBottom: 16 },
    title: { fontSize: 28, fontWeight: '800', color: C.textPrimary, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 15, color: C.textTertiary, textAlign: 'center', lineHeight: 22, marginBottom: 28 },

    tabs: { flexDirection: 'row', backgroundColor: C.inputBg, borderRadius: 10, padding: 3, marginBottom: 24, width: '100%' },
    tab: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
    tabActive: { backgroundColor: C.surface, shadowColor: C.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
    tabText: { fontSize: 14, fontWeight: '500', color: C.textTertiary },
    tabTextActive: { color: C.textPrimary, fontWeight: '700' },

    form: { width: '100%' },
    label: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 6, marginTop: 14 },
    input: { backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.textPrimary },
    passwordRow: { flexDirection: 'row', backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 10, alignItems: 'center' },
    passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.textPrimary },
    eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
    eyeText: { fontSize: 16 },

    primaryBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
    btnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    forgotRow: { alignItems: 'flex-end', marginTop: 10 },
    forgotText: { fontSize: 13, color: C.primary, fontWeight: '600' },

    linkRow: { alignItems: 'center', marginTop: 16 },
    linkText: { fontSize: 14, color: C.textTertiary },
    linkBold: { color: C.primary, fontWeight: '700' },

    googleHint: { fontSize: 14, color: C.textTertiary, textAlign: 'center', marginBottom: 20, marginTop: 8 },
    googleBtn: { backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
    googleBtnText: { fontSize: 15, fontWeight: '600', color: C.textPrimary },

    mockBadge: { marginTop: 24, fontSize: 11, color: C.textMuted, backgroundColor: C.inputBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
    restaurantLinkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' },
    restaurantLinkLabel: { fontSize: 13, color: C.textMuted },
    restaurantLink: { fontSize: 13, color: C.primary, fontWeight: '700' },
  });
}

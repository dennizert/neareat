import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { signInWithGoogle, loginWithEmail } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { useAppInit } from '../../hooks/useAppInit';
import { MOCK_MODE } from '../../config';
import { MOCK_USER } from '../../mocks/data';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import EatlasLogo from '../../components/EatlasLogo';
import EatlasMark from '../../components/EatlasMark';
import AppIcon from '../../components/AppIcon';
import AuthInput from '../../components/auth/AuthInput';
import GlowButton from '../../components/auth/GlowButton';

type AuthTab = 'email' | 'google';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { setPendingUser, setUser, setSubscription, setRestaurantStatus } = useAuthStore();
  const { initApp } = useAppInit();
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [tab, setTab] = useState<AuthTab>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      {/* Köşe markası — sol üst */}
      <View style={[styles.cornerLogo, { top: Math.max(insets.top, 12) + 4 }]} pointerEvents="none">
        <EatlasLogo size={20} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top, 12) + 56 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <EatlasMark size={78} style={styles.mark} />
        <Text style={styles.title}>Hoş geldin</Text>
        <Text style={styles.subtitle}>Favorilerini kaydet, yorum yap, kişiselleştirilmiş deneyim yaşa.</Text>

        {/* Kart */}
        <View style={styles.card}>
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
              <AuthInput
                icon="email"
                label="E-posta"
                placeholder="ornek@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <AuthInput
                icon="lock"
                label="Şifre"
                placeholder="Şifreniz"
                value={password}
                onChangeText={setPassword}
                isPassword
                autoCapitalize="none"
              />

              <TouchableOpacity style={styles.forgotRow} onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotText}>Şifremi Unuttum</Text>
              </TouchableOpacity>

              <GlowButton label="Giriş Yap" onPress={handleEmailLogin} loading={loading} style={styles.cta} />

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
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={C.textPrimary} />
                ) : (
                  <>
                    <AppIcon name={MOCK_MODE ? 'flash' : 'google'} size={18} color={C.textPrimary} />
                    <Text style={styles.googleBtnText}>
                      {MOCK_MODE ? 'Test Kullanıcısı ile Giriş' : 'Google ile Giriş Yap'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

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
    flex: { flex: 1, backgroundColor: C.background },
    cornerLogo: { position: 'absolute', left: 24, zIndex: 10 },
    container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 36 },

    mark: { marginBottom: 22 },
    title: { fontSize: 30, fontWeight: '800', color: C.textPrimary, marginBottom: 8, textAlign: 'center', letterSpacing: -0.3 },
    subtitle: { fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 8 },

    // Derinlikli kart
    card: {
      width: '100%', backgroundColor: C.surface, borderRadius: 22, padding: 20,
      borderWidth: 1, borderColor: C.border,
      shadowColor: C.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.10, shadowRadius: 24, elevation: 4,
    },

    tabs: { flexDirection: 'row', backgroundColor: C.inputBg, borderRadius: 12, padding: 4, marginBottom: 20 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
    tabActive: { backgroundColor: C.surface, shadowColor: C.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2 },
    tabText: { fontSize: 14, fontWeight: '500', color: C.textTertiary },
    tabTextActive: { color: C.textPrimary, fontWeight: '700' },

    form: { width: '100%' },

    forgotRow: { alignSelf: 'flex-end', marginTop: 12 },
    forgotText: { fontSize: 13, color: C.primaryText, fontWeight: '600' },

    cta: { marginTop: 18 },
    btnDisabled: { opacity: 0.6 },

    linkRow: { alignItems: 'center', marginTop: 18 },
    linkText: { fontSize: 14, color: C.textTertiary },
    linkBold: { color: C.primaryText, fontWeight: '700' },

    googleHint: { fontSize: 14, color: C.textSecondary, textAlign: 'center', marginBottom: 20, marginTop: 8 },
    googleBtn: {
      flexDirection: 'row', gap: 10, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
      borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    },
    googleBtnText: { fontSize: 15, fontWeight: '600', color: C.textPrimary },

    restaurantLinkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 28, flexWrap: 'wrap', justifyContent: 'center' },
    restaurantLinkLabel: { fontSize: 13, color: C.textMuted },
    restaurantLink: { fontSize: 13, color: C.primaryText, fontWeight: '700' },

    mockBadge: { marginTop: 22, fontSize: 11, color: C.textMuted, backgroundColor: C.inputBg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, overflow: 'hidden' },
  });
}

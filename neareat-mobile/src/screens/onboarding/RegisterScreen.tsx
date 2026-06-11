import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { registerWithEmail } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { MOCK_MODE } from '../../config';
import { MOCK_USER } from '../../mocks/data';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import PrivacyPolicyModal from '../../components/PrivacyPolicyModal';
import EatlasLogo from '../../components/EatlasLogo';
import EatlasMark from '../../components/EatlasMark';
import AppIcon from '../../components/AppIcon';
import AuthInput from '../../components/auth/AuthInput';
import GlowButton from '../../components/auth/GlowButton';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { setPendingUser } = useAuthStore();
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [policyVisible, setPolicyVisible] = useState(false);
  const [policyTab, setPolicyTab] = useState<'privacy' | 'kvkk'>('privacy');

  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;

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
    if (password.length < 8) {
      Alert.alert('Hata', 'Şifre en az 8 karakter olmalı.');
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

  const topPad = Math.max(insets.top, 12);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Köşe: geri (sol) + wordmark (sağ) */}
      <View style={[styles.topBar, { top: topPad + 2 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <AppIcon name="back" size={22} color={C.textPrimary} />
          <Text style={styles.backText}>Geri</Text>
        </TouchableOpacity>
        <EatlasLogo size={18} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: topPad + 60 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <EatlasMark size={66} style={styles.mark} />
        <Text style={styles.title}>Hesap Oluştur</Text>
        <Text style={styles.subtitle}>Eatlas'a katıl, restoranları keşfet.</Text>

        <View style={styles.card}>
          <AuthInput
            icon="profile"
            label="Ad Soyad"
            placeholder="Adınız Soyadınız"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoCorrect={false}
            containerStyle={styles.firstField}
          />
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
            placeholder="En az 8 karakter"
            value={password}
            onChangeText={setPassword}
            isPassword
            autoCapitalize="none"
          />
          <AuthInput
            icon="lock"
            label="Şifre Tekrar"
            placeholder="Şifrenizi tekrar girin"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            autoCapitalize="none"
            error={mismatch ? 'Şifreler eşleşmiyor' : null}
          />

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

          <GlowButton label="Kayıt Ol" onPress={handleRegister} loading={loading} style={styles.cta} />

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
    flex: { flex: 1, backgroundColor: C.background },
    topBar: {
      position: 'absolute', left: 20, right: 20, zIndex: 10,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    backText: { fontSize: 15, color: C.textPrimary, fontWeight: '600' },

    container: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingBottom: 36 },
    mark: { marginBottom: 18 },
    title: { fontSize: 28, fontWeight: '800', color: C.textPrimary, marginBottom: 8, textAlign: 'center', letterSpacing: -0.3 },
    subtitle: { fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

    card: {
      width: '100%', backgroundColor: C.surface, borderRadius: 22, padding: 20,
      borderWidth: 1, borderColor: C.border,
      shadowColor: C.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.10, shadowRadius: 24, elevation: 4,
    },
    firstField: { marginTop: 0 },

    privacyNotice: {
      backgroundColor: C.background, borderRadius: 12, padding: 12,
      marginTop: 18, borderWidth: 1, borderColor: C.border,
    },
    privacyText: { fontSize: 12, color: C.textTertiary, lineHeight: 18, textAlign: 'center' },
    privacyLink: { color: C.primaryText, fontWeight: '600', textDecorationLine: 'underline' },

    cta: { marginTop: 16 },
    linkRow: { alignItems: 'center', marginTop: 18 },
    linkText: { fontSize: 14, color: C.textTertiary },
    linkBold: { color: C.primaryText, fontWeight: '700' },
  });
}

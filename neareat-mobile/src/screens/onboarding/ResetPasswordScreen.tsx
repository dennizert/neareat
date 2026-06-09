import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { resetPassword } from '../../services/auth';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import EatlasLogo from '../../components/EatlasLogo';
import AppIcon from '../../components/AppIcon';
import AuthInput from '../../components/auth/AuthInput';
import GlowButton from '../../components/auth/GlowButton';

export default function ResetPasswordScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const token: string = route.params?.token ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const topPad = Math.max(insets.top, 12);

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
        <View style={[styles.medallion, styles.medallionSuccess]}>
          <AppIcon name="verified" size={44} color={C.success} />
        </View>
        <Text style={styles.title}>Şifren Güncellendi!</Text>
        <Text style={styles.subtitle}>Yeni şifrenle giriş yapabilirsin.</Text>
        <GlowButton label="Giriş Yap" onPress={() => navigation.navigate('Login')} style={styles.ctaWide} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, { top: topPad + 2 }]}>
        <EatlasLogo size={18} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: topPad + 70 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.medallion}>
          <AppIcon name="lock" size={38} color={C.primary} />
        </View>
        <Text style={styles.title}>Yeni Şifre Belirle</Text>
        <Text style={styles.subtitle}>En az 8 karakter uzunluğunda bir şifre seç.</Text>

        <View style={styles.form}>
          <AuthInput
            icon="lock"
            label="Yeni Şifre"
            placeholder="En az 8 karakter"
            value={password}
            onChangeText={setPassword}
            isPassword
            autoCapitalize="none"
            containerStyle={styles.firstField}
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
          <GlowButton label="Şifremi Güncelle" onPress={handleReset} loading={loading} style={styles.cta} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },
    centerContent: { justifyContent: 'center', alignItems: 'center', padding: 28 },
    topBar: { position: 'absolute', right: 20, zIndex: 10 },

    container: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingBottom: 36 },

    medallion: {
      width: 84, height: 84, borderRadius: 26, backgroundColor: C.primarySurface,
      alignItems: 'center', justifyContent: 'center', marginBottom: 22,
      borderWidth: 1, borderColor: C.primaryLight,
    },
    medallionSuccess: { backgroundColor: C.successSurface, borderColor: C.successSurface },

    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, marginBottom: 10, textAlign: 'center', letterSpacing: -0.3 },
    subtitle: { fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 6 },

    form: { width: '100%' },
    firstField: { marginTop: 0 },
    cta: { marginTop: 22 },
    ctaWide: { marginTop: 8, alignSelf: 'stretch' },
  });
}
